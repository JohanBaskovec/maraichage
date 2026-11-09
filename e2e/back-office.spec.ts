import { expect, test, type Page } from '@playwright/test';
import { ouvrir, verifierAccessibilite, verifierLargeur } from './outils';

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
	await page.getByLabel('Ouverture des commandes').fill('2026-11-09T08:00');
	await page.getByLabel('Clôture des commandes').fill('2026-11-12T20:00');
	await envoyer(page, 'dates');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('12 novembre à 20:00');

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
	await creneau.getByLabel('Jour').fill('2026-11-14');
	await creneau.getByLabel('Lieu').fill('À la ferme');
	await creneau.getByLabel('Commandes max').fill('30');
	await envoyer(page, 'ajouterCreneau');
	await expect(page.locator('.creneau')).toContainText('samedi 14 novembre');
	await expect(page.locator('.creneau')).toContainText('0 commande sur 30');

	await envoyer(page, 'statut', page.getByRole('button', { name: 'Publier la vente' }));
	await expect(page.locator('h1 .badge')).toHaveText('Publiée');
	await verifierAccessibilite(page);
	await verifierLargeur(page);

	// Duplication : semaine suivante, en brouillon, mêmes produits et prix.
	const source = page.url();
	await ouvrir(page, '/admin');
	await page.getByRole('button', { name: 'Nouvelle vente à partir de la dernière' }).click();
	await expect(page).not.toHaveURL(source);
	await expect(page).toHaveURL(/\/admin\/ventes\/\d+$/);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('19 novembre à 20:00');
	await expect(page.locator('h1 .badge')).toHaveText('Brouillon');
	await expect(page.locator('.offre strong')).toHaveText(['Concombre', 'Pommes de terre']);
	await expect(page.locator('.offre').first().getByLabel(/^Prix/)).toHaveValue('0,90');
	await expect(page.locator('.creneau')).toContainText('samedi 21 novembre');

	await ouvrir(page, '/admin');
	await expect(page.locator('.ventes li')).toHaveCount(2);
	await verifierAccessibilite(page);
	await verifierLargeur(page);
});
