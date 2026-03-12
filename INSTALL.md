# INSTALL — Intra42 DIY Extension

## Prérequis
- Google Chrome (ou Chromium / Brave)
- Accès à `intra.42.fr` avec ton compte 42

---

## Installation (mode développeur)

1. **Ouvre les extensions Chrome**
   ```
   chrome://extensions
   ```

2. **Active le mode développeur** (toggle en haut à droite)

3. **Clique « Charger l'extension non empaquetée »**
   - Sélectionne le dossier :
   ```
   /home/zqian/zqian/intra42_diy
   ```

4. ✅ L'extension **"Intra42 DIY"** apparaît dans la barre d'outils

---

## Utilisation — Collecte des données de debug

> **C'est la première étape importante.** L'extension a besoin des données de ta page
> pour calculer correctement les heures par période.

1. **Va sur ton profil intra** :
   ```
   https://intra.42.fr/users/zqian
   ```

2. **Attends 5-10 secondes** que la page charge complètement
   (l'extension intercepte les appels API en arrière-plan)

3. **Cherche le widget injecté** — il apparaît dans la section logtime/calendrier :
   - Un dropdown **"📅 Période"** avec les options de 1 semaine à 24 mois
   - Un bouton **"📥 Debug Data"**

4. **Clique "📥 Debug Data"** → Un fichier JSON est téléchargé

5. **Partage ce fichier** avec le développeur (Antigravity) pour affiner le calcul

---

## Console de debug (F12)

Tu peux aussi inspecter directement dans la console du navigateur :

```javascript
// Voir les logs de l'extension
intra42DIY.getLogs()

// Voir les appels API capturés
intra42DIY.getCaptures()

// Forcer le téléchargement du debug
intra42DIY.downloadDebug()

// Réinjecter le widget si nécessaire
intra42DIY.forceReinject()
```

---

## Structure des fichiers

```
intra42_diy/
├── manifest.json          # Configuration de l'extension
├── injector.js            # Démarre l'extension (document_start)
├── network-interceptor.js # Capture les appels fetch/XHR
├── content.js             # Logique principale (dropdown + debug)
├── popup.html/js          # Popup de l'extension
├── styles.css             # Styles injectés
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
