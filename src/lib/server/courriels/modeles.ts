import { INFOS_LEGALES, NOM_BOUTIQUE } from '#lib/config.ts';
import { formatEuros, formatQuantite } from '#lib/format.ts';
import { formatDateHeure, formatJour } from '#lib/heure.ts';
import { prixLigneCentimes, type Unite } from '#lib/prix.ts';
import type { CoordonneesVirement } from '#lib/virement.ts';
import type { Courriel } from './envoi.ts';

// Modèles des e-mails envoyés aux clients. Chaque e-mail existe en HTML (styles
// en ligne, compatibles avec les messageries) et en texte brut. Tout ce qui
// vient d'une saisie (nom du client, produits, lieu…) est échappé.

export interface CommandeCourriel {
	id: string;
	reference: string;
	nom: string;
	email: string;
	modePaiement: 'retrait' | 'virement';
	statut: string;
	payee: boolean;
	totalCentimes: number;
	paiementAvant: Date | null;
	jetonAnnulation: string;
	limiteAnnulation: Date;
	creneau: { date: string; heureDebut: string; heureFin: string; lieu: string };
	lignes: { produit: string; unite: Unite; quantite: number; prixUnitaireCentimes: number }[];
}

export function echapper(texte: string): string {
	return texte
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

const prenom = (nom: string) => nom.trim().split(/\s+/)[0] ?? nom;
const retrait = (c: CommandeCourriel) =>
	`${formatJour(c.creneau.date)}, entre ${c.creneau.heureDebut} et ${c.creneau.heureFin} – ${c.creneau.lieu}`;
const prixLigne = (l: CommandeCourriel['lignes'][number]) =>
	formatEuros(prixLigneCentimes(l.unite, l.prixUnitaireCentimes, l.quantite));

const COULEUR = '#2f6b3a';

function gabarit(titre: string, corps: string): string {
	return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2a1f;">
<div style="max-width:560px;margin:0 auto;padding:16px;">
<div style="background:${COULEUR};color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:600;">${echapper(NOM_BOUTIQUE)}</div>
<div style="background:#fff;padding:20px;border-radius:0 0 10px 10px;line-height:1.5;font-size:16px;">
${corps}
</div>
<p style="color:#5f6b5f;font-size:13px;text-align:center;margin:16px 0;">${echapper(NOM_BOUTIQUE)} · ${echapper(INFOS_LEGALES.email)}<br>Répondez simplement à cet e-mail pour nous écrire.</p>
</div></body></html>`;
}

function tableauLignes(c: CommandeCourriel): string {
	const lignes = c.lignes
		.map(
			(l) =>
				`<tr><td style="padding:6px 0;border-bottom:1px solid #e3e6df;">${echapper(l.produit)}</td>` +
				`<td style="padding:6px 8px;border-bottom:1px solid #e3e6df;color:#5f6b5f;white-space:nowrap;">${echapper(formatQuantite(l.unite, l.quantite))}</td>` +
				`<td style="padding:6px 0;border-bottom:1px solid #e3e6df;text-align:right;white-space:nowrap;">${echapper(prixLigne(l))}</td></tr>`
		)
		.join('');
	return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 4px;">${lignes}<tr><td style="padding:8px 0;font-weight:600;" colspan="2">Total</td><td style="padding:8px 0;text-align:right;font-weight:600;">${echapper(formatEuros(c.totalCentimes))}</td></tr></table>`;
}

const texteLignes = (c: CommandeCourriel) =>
	[
		...c.lignes.map(
			(l) => `- ${l.produit} : ${formatQuantite(l.unite, l.quantite)} – ${prixLigne(l)}`
		),
		`Total : ${formatEuros(c.totalCentimes)}`
	].join('\n');

const bouton = (url: string, texte: string) =>
	`<a href="${echapper(url)}" style="display:inline-block;background:${COULEUR};color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">${echapper(texte)}</a>`;

const lien = (url: string, texte: string) =>
	`<a href="${echapper(url)}" style="color:${COULEUR};">${echapper(texte)}</a>`;

function blocVirement(
	c: CommandeCourriel,
	v: CoordonneesVirement
): { html: string; texte: string } {
	const avant = c.paiementAvant ? formatDateHeure(c.paiementAvant) : '';
	const champs: [string, string][] = [
		['Montant', formatEuros(c.totalCentimes)],
		['Bénéficiaire', v.titulaire],
		['IBAN', v.iban],
		...(v.bic ? ([['BIC', v.bic]] as [string, string][]) : []),
		['Libellé', c.reference]
	];
	const html =
		`<div style="border:2px solid ${COULEUR};border-radius:8px;padding:12px 16px;margin:16px 0;">` +
		`<p style="margin:0 0 8px;font-weight:600;">À payer par virement avant le ${echapper(avant)}</p>` +
		`<table role="presentation" style="border-collapse:collapse;">` +
		champs
			.map(
				([k, val]) =>
					`<tr><td style="padding:2px 12px 2px 0;color:#5f6b5f;">${k}</td><td style="padding:2px 0;font-family:ui-monospace,Menlo,monospace;">${echapper(val)}</td></tr>`
			)
			.join('') +
		`</table><p style="margin:8px 0 0;font-size:14px;color:#5f6b5f;">Indiquez bien la référence ${echapper(c.reference)} dans le libellé. Sans virement reçu à temps, la commande est annulée automatiquement.</p></div>`;
	const texte = [
		`À payer par virement avant le ${avant} :`,
		...champs.map(([k, val]) => `${k} : ${val}`),
		`Indiquez bien la référence ${c.reference} dans le libellé. Sans virement reçu à temps, la commande est annulée automatiquement.`
	].join('\n');
	return { html, texte };
}

/** E-mail envoyé juste après la commande. */
export function courrielConfirmation(
	c: CommandeCourriel,
	options: { urlBase: string; virement: CoordonneesVirement | null; maintenant?: Date }
): Courriel {
	const urlCommande = `${options.urlBase}/commande/${c.id}`;
	const urlAnnulation = `${options.urlBase}/annuler/${c.jetonAnnulation}`;
	const attendVirement = c.statut === 'en_attente_paiement';
	const virement = attendVirement && options.virement ? blocVirement(c, options.virement) : null;
	const annulable = (options.maintenant ?? new Date()) < c.limiteAnnulation;
	const paiement =
		c.modePaiement === 'retrait'
			? `Paiement au retrait (${formatEuros(c.totalCentimes)}), en espèces ou par chèque.`
			: attendVirement
				? ''
				: 'Paiement par virement.';
	const sujet = `Commande ${c.reference}${attendVirement ? ' – virement à effectuer' : ''} – ${NOM_BOUTIQUE}`;

	const html = gabarit(
		sujet,
		`<p style="margin-top:0;">Bonjour ${echapper(prenom(c.nom))},</p>
<p>Merci pour votre commande ! Voici votre référence, à donner au retrait :</p>
<p style="font-size:26px;font-weight:700;letter-spacing:2px;margin:8px 0 16px;">${echapper(c.reference)}</p>
${virement?.html ?? ''}
<p><strong>Retrait :</strong> ${echapper(retrait(c))}</p>
${tableauLignes(c)}
${paiement ? `<p>${echapper(paiement)}</p>` : ''}
<p style="margin:20px 0;">${bouton(urlCommande, 'Voir ma commande')}</p>
${annulable ? `<p style="font-size:14px;color:#5f6b5f;">Un empêchement ? ${lien(urlAnnulation, 'Annuler ma commande')} (possible jusqu’au ${echapper(formatDateHeure(c.limiteAnnulation))}).</p>` : ''}`
	);

	const texte = [
		`Bonjour ${prenom(c.nom)},`,
		'',
		'Merci pour votre commande !',
		`Référence (à donner au retrait) : ${c.reference}`,
		'',
		...(virement ? [virement.texte, ''] : []),
		`Retrait : ${retrait(c)}`,
		'',
		texteLignes(c),
		...(paiement ? ['', paiement] : []),
		'',
		`Voir ma commande : ${urlCommande}`,
		...(annulable
			? [
					`Un empêchement ? Annuler ma commande (jusqu’au ${formatDateHeure(c.limiteAnnulation)}) : ${urlAnnulation}`
				]
			: []),
		'',
		`${NOM_BOUTIQUE} – répondez à cet e-mail pour nous écrire.`
	].join('\n');

	return { a: c.email, sujet, html, texte, cleIdempotence: `confirmation-${c.id}` };
}

/** E-mail de rappel envoyé la veille du retrait. */
export function courrielRappel(
	c: CommandeCourriel,
	options: { urlBase: string; maintenant: Date }
): Courriel {
	const urlAnnulation = `${options.urlBase}/annuler/${c.jetonAnnulation}`;
	const annulable = options.maintenant < c.limiteAnnulation;
	const paiement = c.payee
		? 'Votre commande est déjà payée.'
		: `À régler au retrait : ${formatEuros(c.totalCentimes)}, en espèces ou par chèque.`;
	const sujet = `Rappel : retrait de votre commande ${c.reference} ${formatJour(c.creneau.date)}`;

	const html = gabarit(
		sujet,
		`<p style="margin-top:0;">Bonjour ${echapper(prenom(c.nom))},</p>
<p>Votre commande <strong>${echapper(c.reference)}</strong> vous attend :</p>
<p style="font-size:18px;"><strong>${echapper(retrait(c))}</strong></p>
${tableauLignes(c)}
<p>${echapper(paiement)}</p>
${annulable ? `<p>Vous ne pouvez finalement pas venir ? Merci de ${lien(urlAnnulation, 'libérer votre commande')} avant le ${echapper(formatDateHeure(c.limiteAnnulation))} : les produits seront proposés à d’autres clients.</p>` : '<p>Vous ne pouvez finalement pas venir ? Répondez à cet e-mail pour nous prévenir.</p>'}`
	);

	const texte = [
		`Bonjour ${prenom(c.nom)},`,
		'',
		`Votre commande ${c.reference} vous attend :`,
		retrait(c),
		'',
		texteLignes(c),
		'',
		paiement,
		'',
		annulable
			? `Vous ne pouvez finalement pas venir ? Libérez votre commande avant le ${formatDateHeure(c.limiteAnnulation)} : ${urlAnnulation}`
			: 'Vous ne pouvez finalement pas venir ? Répondez à cet e-mail pour nous prévenir.',
		'',
		`${NOM_BOUTIQUE} – répondez à cet e-mail pour nous écrire.`
	].join('\n');

	return { a: c.email, sujet, html, texte, cleIdempotence: `rappel-${c.id}` };
}
