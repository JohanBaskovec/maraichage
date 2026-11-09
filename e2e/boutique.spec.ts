import { expect, test, type Page } from '@playwright/test';
import { ouvrir, verifierAccessibilite, verifierLargeur } from './outils';

// Données : e2e/donnees-boutique.sql. Les tests s'enchaînent sur la même base.
test.describe.configure({ mode: 'serial' });

const produit = (page: Page, nom: string) => page.locator('li.produit', { hasText: nom });
const plus = (page: Page, nom: string) =>
	produit(page, nom).getByRole('button', { name: /^Ajouter/ });
const moins = (page: Page, nom: string) =>
	produit(page, nom).getByRole('button', { name: /^Retirer/ });

async function remplirCoordonnees(page: Page, nom: string, email: string) {
	await page.getByLabel('Nom et prénom').fill(nom);
	await page.getByLabel('E-mail').fill(email);
	await page.getByLabel('Téléphone').fill('06 12 34 56 78');
}

test('le catalogue montre les produits en vente, sans les épuisés ni les masqués', async ({
	page
}) => {
	await ouvrir(page, '/');
	await expect(page.locator('li.produit strong')).toHaveText([
		'Concombre',
		'Pommes de terre',
		'Radis'
	]);
	await expect(produit(page, 'Concombre')).toContainText('0,80 € la pièce');
	await expect(produit(page, 'Pommes de terre')).toContainText('reste 80 kg');
	await verifierAccessibilite(page);
	await verifierLargeur(page);
});

test('un client remplit son panier, commande et reçoit sa référence', async ({ page }) => {
	await ouvrir(page, '/');
	for (let i = 0; i < 3; i++) await plus(page, 'Concombre').click();
	await moins(page, 'Concombre').click();
	for (let i = 0; i < 3; i++) await plus(page, 'Pommes de terre').click();
	await expect(produit(page, 'Concombre').locator('output')).toHaveText('2 pièces');
	await expect(produit(page, 'Pommes de terre').locator('output')).toHaveText('1,5 kg');
	await expect(page.locator('.barre')).toContainText('5,35 €');

	// Le panier survit à un rechargement.
	await page.reload();
	await expect(page.locator('.barre')).toContainText('5,35 €');

	await page.getByRole('link', { name: 'Valider mon panier' }).click();
	await expect(page).toHaveURL(/\/commande\?/);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('table')).toContainText('Concombre');
	await expect(page.locator('tfoot')).toContainText('5,35 €');
	await verifierAccessibilite(page);
	await verifierLargeur(page);

	await remplirCoordonnees(page, 'Camille Martin', 'camille@example.fr');
	await page.getByText('À la ferme').click();
	await page.getByLabel(/J’ai lu et j’accepte/).check();
	await page.getByRole('button', { name: /Commander – je paierai 5,35 €/ }).click();

	await expect(page).toHaveURL(/\/commande\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Merci Camille, votre commande est enregistrée'
	);
	await expect(page.locator('.reference strong')).toHaveText(/^MAR-[2-9A-HJKMNP-Z]{4}$/);
	await expect(page.locator('main')).toContainText('À la ferme');
	await expect(page.locator('tfoot')).toContainText('5,35 €');
	await verifierAccessibilite(page);
	await verifierLargeur(page);

	// Retour à la boutique : panier vidé, stock à jour.
	await ouvrir(page, '/');
	await expect(page.locator('.barre')).toHaveCount(0);
	await expect(produit(page, 'Concombre')).toContainText('reste 198 pièces');
	await expect(produit(page, 'Pommes de terre')).toContainText('reste 78,5 kg');

	// Les coordonnées sont pré-remplies la fois suivante.
	await plus(page, 'Concombre').click();
	await page.getByRole('link', { name: 'Valider mon panier' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByLabel('E-mail')).toHaveValue('camille@example.fr');
});

test('on ne peut pas mettre plus que le stock, ni plus de 20 par commande', async ({ page }) => {
	await ouvrir(page, '/');
	for (let i = 0; i < 3; i++) await plus(page, 'Radis').click();
	await expect(produit(page, 'Radis').locator('output')).toHaveText('3 bottes');
	await expect(plus(page, 'Radis')).toBeDisabled();

	for (let i = 0; i < 20; i++) await plus(page, 'Concombre').click();
	await expect(produit(page, 'Concombre').locator('output')).toHaveText('20 pièces');
	await expect(plus(page, 'Concombre')).toBeDisabled();
	await expect(produit(page, 'Concombre')).toContainText('20 pièces au plus par commande');
});

test('si un autre client est plus rapide, le panier est ajusté sans perdre la saisie', async ({
	browser
}) => {
	const lent = await (await browser.newContext()).newPage();
	const rapide = await (await browser.newContext()).newPage();

	// Le client lent met les 3 radis dans son panier et arrive à la validation.
	await ouvrir(lent, '/');
	for (let i = 0; i < 3; i++) await plus(lent, 'Radis').click();
	await lent.getByRole('link', { name: 'Valider mon panier' }).click();
	await lent.waitForLoadState('networkidle');
	await remplirCoordonnees(lent, 'Lou Lent', 'lou@example.fr');

	// Pendant ce temps, un autre client achète 2 radis et la dernière place du marché.
	await ouvrir(rapide, '/');
	await plus(rapide, 'Radis').click();
	await plus(rapide, 'Radis').click();
	await rapide.getByRole('link', { name: 'Valider mon panier' }).click();
	await rapide.waitForLoadState('networkidle');
	await remplirCoordonnees(rapide, 'Sam Rapide', 'sam@example.fr');
	await rapide.getByText('Marché de la place').click();
	await rapide.getByLabel(/J’ai lu et j’accepte/).check();
	await rapide.getByRole('button', { name: /^Commander/ }).click();
	await expect(rapide).toHaveURL(/\/commande\/[0-9a-f-]{36}$/);

	// Le client lent valide : refusé, panier ajusté, saisie conservée.
	await lent.getByText('À la ferme').click();
	await lent.getByLabel(/J’ai lu et j’accepte/).check();
	await lent.getByRole('button', { name: /^Commander/ }).click();
	await expect(lent.getByRole('alert')).toContainText('Radis : il n’en reste que 1 botte.');
	await expect(lent.locator('.avert')).toContainText('Radis ramené à 1 botte');
	await expect(lent.locator('tbody')).toContainText('1 botte');
	await expect(lent.getByLabel('Nom et prénom')).toHaveValue('Lou Lent');
	// Le créneau du marché est maintenant complet.
	await expect(lent.getByRole('radio', { name: /Marché de la place/ })).toBeDisabled();

	// Il revalide avec le panier ajusté.
	await lent.getByLabel(/J’ai lu et j’accepte/).check();
	await lent.getByRole('button', { name: /Commander – je paierai 1,50 €/ }).click();
	await expect(lent).toHaveURL(/\/commande\/[0-9a-f-]{36}$/);

	// Plus de radis pour personne.
	await ouvrir(lent, '/');
	await expect(produit(lent, 'Radis')).toContainText('épuisé');
});

test('un client annule lui-même sa commande ; le stock revient', async ({ page }) => {
	await ouvrir(page, '/');
	const avant = await produit(page, 'Concombre').locator('.discret').first().textContent();
	await plus(page, 'Concombre').click();
	await plus(page, 'Concombre').click();
	await page.getByRole('link', { name: 'Valider mon panier' }).click();
	await page.waitForLoadState('networkidle');
	await remplirCoordonnees(page, 'Alex Annule', 'alex@example.fr');
	await page.getByText('À la ferme').click();
	await page.getByLabel(/J’ai lu et j’accepte/).check();
	await page.getByRole('button', { name: /^Commander/ }).click();
	await expect(page).toHaveURL(/\/commande\/[0-9a-f-]{36}$/);
	const reference = await page.locator('.reference strong').textContent();

	// Le lien mène à une page de confirmation : l'ouvrir n'annule rien.
	await page.getByRole('link', { name: 'Annuler ma commande' }).click();
	await expect(page).toHaveURL(/\/annuler\//);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Annuler ma commande ?');
	await verifierAccessibilite(page);
	await page.getByRole('button', { name: 'Oui, annuler ma commande' }).click();
	await expect(page.getByRole('status')).toContainText(`La commande ${reference} est annulée.`);

	// Recharger le lien : déjà annulée.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commande annulée');
	await ouvrir(page, '/');
	await expect(produit(page, 'Concombre').locator('.discret').first()).toHaveText(avant!);
});

test('une adresse de commande ou d’annulation inconnue répond 404', async ({ page }) => {
	for (const chemin of ['/commande/00000000-0000-4000-8000-000000000000', '/annuler/inconnu']) {
		const reponse = await page.goto(chemin);
		expect(reponse?.status()).toBe(404);
	}
});
