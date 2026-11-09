import { expect, test, type Page } from '@playwright/test';
import { depuisChampParis, formatDateHeure, versChampParis } from '../src/lib/heure';
import { ouvrir, verifierAccessibilite, verifierLargeur } from './outils';

// Dates calculées à partir d'aujourd'hui : la vente doit être ouverte pendant le test.
const JOUR = 86_400_000;
const jourParis = (decalage: number) =>
	versChampParis(new Date(Date.now() + decalage * JOUR)).slice(0, 10);
const OUVERTURE = `${jourParis(-1)}T08:00`;
const CLOTURE = `${jourParis(3)}T20:00`;
const RETRAIT = jourParis(5);
const libelleCloture = (decalageJours = 0) =>
	formatDateHeure(new Date(depuisChampParis(CLOTURE)!.getTime() + decalageJours * JOUR));
let urlVente = '';

// Serveur de développement (back-office ouvert), base vide au départ.
test.describe.configure({ mode: 'serial' });

/**
 * Envoie un formulaire amélioré et attend la fin réelle de l'envoi : réponse de
 * l'action puis, si elle a réussi, rechargement des données de la page.
 * (`waitForLoadState('networkidle')` ne suffit pas : il rend la main tout de suite
 * si la page avait déjà été au repos.)
 */
async function envoyer(
	page: Page,
	action: string,
	bouton = page.locator(`form[action="?/${action}"] button`).first()
) {
	const donnees = page.waitForResponse((r) => r.url().includes('__data.json'));
	donnees.catch(() => {});
	const [reponse] = await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(`/${action}`)),
		bouton.click()
	]);
	const resultat = await reponse.json().catch(() => null);
	if (resultat?.type === 'success') await donnees;
}

test('le maraîcher crée son catalogue de produits', async ({ page }) => {
	await ouvrir(page, '/admin/produits');
	const nouveau = page.locator('form[action="?/creer"]');
	for (const [nom, unite, pas] of [
		['Concombre', 'à la pièce', '1'],
		['Pommes de terre', 'au kg', '0,5'],
		['Radis', 'à la botte', '1']
	]) {
		await nouveau.getByLabel('Nom').fill(nom);
		await nouveau.getByLabel('Vendu').selectOption({ label: unite });
		await nouveau.getByLabel('Le client ajoute par').fill(pas);
		await envoyer(page, 'creer');
	}
	await expect(page.locator('form[action="?/modifier"] input[name=nom]')).toHaveCount(3);

	// Un nom vide est refusé par le serveur.
	await nouveau.getByLabel('Nom').fill('   ');
	await envoyer(page, 'creer');
	await expect(nouveau.locator('.erreur')).toHaveText('Le nom est obligatoire.');

	await verifierAccessibilite(page);
	await verifierLargeur(page);
});

test('il prépare une vente, la publie, puis la duplique pour la semaine suivante', async ({
	page
}) => {
	await ouvrir(page, '/admin');
	await page.getByRole('button', { name: 'Nouvelle vente vide' }).click();
	await expect(page).toHaveURL(/\/admin\/ventes\/\d+$/);
	await page.waitForLoadState('networkidle');

	// Dates, à l'heure de Paris.
	urlVente = page.url();
	await page.getByLabel('Ouverture des commandes').fill(OUVERTURE);
	await page.getByLabel('Clôture des commandes').fill(CLOTURE);
	await envoyer(page, 'dates');
	await expect(page.getByRole('heading', { level: 1 })).toContainText(libelleCloture());

	// Publication refusée tant qu'il manque produits et créneaux.
	await envoyer(page, 'statut', page.getByRole('button', { name: 'Publier la vente' }));
	await expect(page.locator('.erreur').first()).toHaveText(
		'Ajoute au moins un produit avant de publier.'
	);

	// Produits, saisis à la française.
	const ajout = page.locator('form[action="?/ajouterOffre"]');
	for (const [nom, prix, qte] of [
		['Concombre', '0,80', '200'],
		['Pommes de terre', '2,50', '80,5']
	]) {
		await ajout.getByLabel('Produit').selectOption({ label: nom });
		await ajout.getByLabel(/^Prix/).fill(prix);
		await ajout.getByLabel(/^Quantité/).fill(qte);
		await envoyer(page, 'ajouterOffre');
	}
	await expect(page.locator('.offre strong')).toHaveText(['Concombre', 'Pommes de terre']);
	await expect(page.locator('.offre').nth(1)).toContainText('reste 80,5 kg');

	// Modifier un prix.
	const concombre = page.locator('.offre').first();
	await concombre.getByLabel(/^Prix/).fill('0,90');
	await envoyer(page, 'modifierOffre', concombre.getByRole('button', { name: 'Enregistrer' }));
	await expect(concombre.locator('.ok')).toHaveText('Enregistré.');
	await expect(concombre.getByLabel(/^Prix/)).toHaveValue('0,90');

	// Créneau.
	const creneau = page.locator('form[action="?/ajouterCreneau"]');
	await creneau.getByLabel('Jour').fill(RETRAIT);
	await creneau.getByLabel('Lieu').fill('À la ferme');
	await creneau.getByLabel('Commandes max').fill('30');
	await envoyer(page, 'ajouterCreneau');
	await expect(page.locator('.creneau')).toContainText('0 commande sur 30');

	await envoyer(page, 'statut', page.getByRole('button', { name: 'Publier la vente' }));
	await expect(page.locator('h1 .badge')).toHaveText('Publiée');
	await verifierAccessibilite(page);
	await verifierLargeur(page);

	// Duplication : semaine suivante, en brouillon, mêmes produits et prix.
	await ouvrir(page, '/admin');
	await page.getByRole('button', { name: 'Nouvelle vente à partir de la dernière' }).click();
	await expect(page).not.toHaveURL(urlVente);
	await expect(page).toHaveURL(/\/admin\/ventes\/\d+$/);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toContainText(libelleCloture(7));
	await expect(page.locator('h1 .badge')).toHaveText('Brouillon');
	await expect(page.locator('.offre strong')).toHaveText(['Concombre', 'Pommes de terre']);
	await expect(page.locator('.offre').first().getByLabel(/^Prix/)).toHaveValue('0,90');
	await expect(page.locator('.creneau')).toHaveCount(1);

	await ouvrir(page, '/admin');
	await expect(page.locator('.ventes li')).toHaveCount(2);
	await verifierAccessibilite(page);
	await verifierLargeur(page);
});

test('des clients commandent ; le maraîcher prépare, encaisse, remet et annule', async ({
	page,
	browser
}) => {
	// Deux clients commandent dans la boutique (la vente publiée est ouverte).
	for (const [nom, concombres, patates] of [
		['Camille Martin', 2, 2],
		['Dominique Petit', 3, 0]
	] as const) {
		const client = await (await browser.newContext()).newPage();
		await ouvrir(client, '/');
		const plus = (produit: string) =>
			client.locator('li.produit', { hasText: produit }).getByRole('button', { name: /^Ajouter/ });
		for (let i = 0; i < concombres; i++) await plus('Concombre').click();
		for (let i = 0; i < patates; i++) await plus('Pommes de terre').click();
		await client.getByRole('link', { name: 'Valider mon panier' }).click();
		await client.waitForLoadState('networkidle');
		await client.getByLabel('Nom et prénom').fill(nom);
		await client.getByLabel('E-mail').fill('client@example.fr');
		await client.getByLabel('Téléphone').fill('06 12 34 56 78');
		await client.getByLabel(/J’ai lu et j’accepte/).check();
		await client.getByRole('button', { name: /^Commander/ }).click();
		await expect(client).toHaveURL(/\/commande\/[0-9a-f-]{36}$/);
		await client.context().close();
	}

	// La vente compte les deux commandes.
	await ouvrir(page, urlVente);
	await expect(page.getByRole('link', { name: 'Commandes (2)' })).toBeVisible();
	await page.getByRole('link', { name: 'Commandes (2)' }).click();
	await page.waitForLoadState('networkidle');
	const commande = (nom: string) => page.locator('article.commande', { hasText: nom });
	await expect(page.locator('article.commande')).toHaveCount(2);
	await expect(page.locator('.resume')).toContainText('à encaisser 7,00 €');
	await expect(commande('Camille Martin')).toContainText('1 kg');
	await verifierAccessibilite(page);
	await verifierLargeur(page);

	// Recherche par nom, sans accent ni majuscule.
	await page.getByLabel('Rechercher').fill('DOMINIQUE');
	await page.getByLabel('Rechercher').press('Enter');
	await expect(page.locator('article.commande')).toHaveCount(1);
	await page.getByLabel('Rechercher').fill('');
	await page.getByLabel('Rechercher').press('Enter');
	await expect(page.locator('article.commande')).toHaveCount(2);

	// Récap de préparation : totaux à cueillir, une fiche par sac.
	await page.getByRole('link', { name: 'Récap de préparation' }).click();
	await page.waitForLoadState('networkidle');
	const totaux = page.locator('table.totaux tbody tr');
	await expect(totaux).toHaveText([/Concombre\s*5 pièces\s*2/, /Pommes de terre\s*1 kg\s*1/]);
	await expect(page.locator('article.fiche')).toHaveCount(2);
	await expect(page.locator('article.fiche', { hasText: 'Dominique' })).toContainText(
		'À encaisser : 2,70 €'
	);
	await verifierAccessibilite(page);
	await verifierLargeur(page);

	// Camille paie et récupère sa commande.
	await page.goBack();
	await page.waitForLoadState('networkidle');
	await envoyer(page, 'payee', commande('Camille Martin').getByRole('button', { name: 'Payée' }));
	await expect(commande('Camille Martin').locator('.badges')).toContainText('Payée');
	await envoyer(
		page,
		'statut',
		commande('Camille Martin').getByRole('button', { name: 'Récupérée' })
	);
	await expect(commande('Camille Martin').locator('.badges')).toContainText('Récupérée');
	await expect(page.locator('.resume')).toContainText('à encaisser 2,70 € · encaissé 4,30 €');

	// Dominique annule : le stock est remis en vente.
	page.once('dialog', (d) => d.accept());
	await envoyer(
		page,
		'annuler',
		commande('Dominique Petit').getByRole('button', { name: 'Annuler la commande' })
	);
	await expect(page.locator('article.commande')).toHaveCount(1);
	await page.getByLabel('Statut').selectOption({ label: 'Annulées' });
	await expect(page.locator('article.commande')).toHaveCount(1);
	await expect(commande('Dominique Petit').locator('.badges')).toContainText('Annulée');

	// Plus rien à préparer ; le catalogue a retrouvé les 3 concombres.
	await ouvrir(page, urlVente.replace(/\/?$/, '/preparation'));
	await expect(page.getByText('Aucune commande à préparer.')).toBeVisible();
	await ouvrir(page, '/');
	await expect(page.locator('li.produit', { hasText: 'Concombre' })).toContainText(
		'reste 198 pièces'
	);
});
