export function actionMessage(status: string) {
  switch (status) {
    case "saved":
      return "Modifications enregistrées.";
    case "conflict":
      return "Ces informations ont changé entre-temps. Recharge la page et réessaie.";
    case "invalid":
      return "Vérifie les valeurs saisies et réessaie.";
    case "session-expired":
      return "Ta session a expiré. Connecte-toi à nouveau.";
    case "missing":
      return "Cet élément n’existe plus.";
    case "no-track":
      return "Aucun tracé GPS exploitable dans cette activité.";
    default:
      return "Impossible d’enregistrer pour le moment. Réessaie.";
  }
}

export function importMessage(status: string) {
  switch (status) {
    case "invalid-file":
      return "Ce fichier n’est pas un GPX valide.";
    case "no-track":
      return "Le fichier ne contient aucun tracé exploitable.";
    case "too-large":
      return "Le fichier dépasse 20 Mo.";
    case "no-course":
      return "Ajoute d’abord le GPX de la course pour placer les points du roadbook.";
    case "nothing-found":
      return "Stride n’a trouvé aucun point de passage avec un kilomètre dans ce document.";
    case "invalid-link":
      return "Ce lien n’est pas accepté. Utilise une adresse https publique.";
    case "unreachable":
      return "Impossible de récupérer ce lien. Vérifie qu’il est public.";
    case "session-expired":
      return "Ta session a expiré. Connecte-toi à nouveau.";
    case "forbidden":
      return "Requête refusée. Recharge la page et réessaie.";
    default:
      return "L’import a échoué. Réessaie.";
  }
}
