// Les dates sont stockées en UTC ; le maraîcher et ses clients pensent en heure de Paris.

const FUSEAU = 'Europe/Paris';

function partiesParis(date: Date) {
	const parties = new Intl.DateTimeFormat('en-GB', {
		timeZone: FUSEAU,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(date);
	const p = (type: string) => parties.find((x) => x.type === type)!.value;
	return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
}

/** Date → « AAAA-MM-JJTHH:MM » à l'heure de Paris (valeur d'un `<input type="datetime-local">`). */
export function versChampParis(date: Date): string {
	return partiesParis(date);
}

/** « AAAA-MM-JJTHH:MM » à l'heure de Paris → Date. `null` si illisible. */
export function depuisChampParis(valeur: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valeur)) return null;
	const commeUtc = new Date(valeur + 'Z');
	if (isNaN(commeUtc.getTime())) return null;
	// Décalage de Paris à cet instant (1 ou 2 h), recalculé une fois pour les changements d'heure.
	let date = commeUtc;
	for (let i = 0; i < 2; i++) {
		const decalage = new Date(partiesParis(date) + 'Z').getTime() - date.getTime();
		date = new Date(commeUtc.getTime() - decalage);
	}
	return date;
}

/** « 2026-11-14 » + n jours */
export function ajouterJours(jour: string, n: number): string {
	const d = new Date(jour + 'T12:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** « samedi 14 novembre » */
export function formatJour(jour: string): string {
	return new Date(jour + 'T12:00:00Z').toLocaleDateString('fr-FR', {
		timeZone: 'UTC',
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

/** « jeudi 12 novembre, 20:00 » (heure de Paris) */
export function formatDateHeure(date: Date): string {
	return date.toLocaleString('fr-FR', {
		timeZone: FUSEAU,
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		hour: '2-digit',
		minute: '2-digit'
	});
}
