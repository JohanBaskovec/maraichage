import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Aucun problème d'accessibilité grave ou critique (axe-core, règles WCAG A/AA). */
export async function verifierAccessibilite(page: Page) {
	const resultat = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	const graves = resultat.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
	expect(graves, `Problèmes d’accessibilité sur ${page.url()}`).toEqual([]);
}

/** Pas de défilement horizontal sur téléphone. */
export async function verifierLargeur(page: Page) {
	const debord = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(debord, `La page ${page.url()} déborde en largeur`).toBeLessThanOrEqual(0);
}

/** Attend que la page soit hydratée (boutons interactifs prêts). */
export async function ouvrir(page: Page, chemin: string) {
	await page.goto(chemin);
	await page.waitForLoadState('networkidle');
}
