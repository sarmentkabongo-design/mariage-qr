// ============================================================
// FIREBASE
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyDj3TAGcx4yTHXeE4RzGLMn-wZDKwj8iV0",
    authDomain: "mariage-qr-e753d.firebaseapp.com",
    projectId: "mariage-qr-e753d",
    storageBucket: "mariage-qr-e753d.firebasestorage.app",
    messagingSenderId: "56943862331",
    appId: "1:56943862331:web:531ca0e0b41d41aa20321e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const invitationsRef = collection(db, "invitations");


// ============================================================
// NORMALISATION NOM + TELEPHONE
// ============================================================

// Transforme le nom pour éviter les différences comme :
// "Jean Dupont"
// " jean  dupont "
// "JEAN DUPONT"
function normaliserNom(nom) {

    return nom
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}


// Transforme le téléphone en chiffres uniquement.
// Exemple :
// "+243 812 345 678" -> "243812345678"
// "0812345678" -> "0812345678"
function normaliserTelephone(telephone) {

    return telephone
        .trim()
        .replace(/\D/g, "");
}


// Clé unique utilisée pour empêcher les doublons.
//
// Exemple :
// nom = Jean Dupont
// téléphone = 0812345678
//
// devient :
// jean-dupont_0812345678
function creerCleDoublon(nom, telephone) {

    const nomNormalise = normaliserNom(nom);

    const telephoneNormalise = normaliserTelephone(telephone);

    const nomSecurise = nomNormalise
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `${nomSecurise}_${telephoneNormalise}`;
}


// ============================================================
// NAVIGATION
// ============================================================

window.showPage = function(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    const page = document.getElementById(pageId);

    if (page) {
        page.classList.add("active");
    }

    if (pageId === "liste") {
        afficherListe();
    }
};


// ============================================================
// MESSAGE
// ============================================================

function afficherMessage(message, type = "info") {

    const element = document.getElementById("message");

    if (!element) return;

    element.innerHTML = `
        <div class="message ${type}">
            ${escapeHtml(message)}
        </div>
    `;
}


// ============================================================
// PROTECTION HTML
// ============================================================

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// CODE QR UNIQUE
// ============================================================

function genererCodeUnique() {

    return (
        "MARIAGE-" +
        Date.now() +
        "-" +
        Math.floor(Math.random() * 9000 + 1000)
    );
}


// ============================================================
// DONNEES CONTENUES DANS LE QR
// ============================================================

function donneesQR(invitation) {

    return JSON.stringify({

        id: invitation.id || null,

        code: invitation.code,

        nom: invitation.nom,

        telephone: invitation.telephone,

        personnes: invitation.personnes,

        type: invitation.type,

        table: invitation.table,

        dateCreation: invitation.dateCreation

    });
}


// ============================================================
// CREATION DU QR
// ============================================================

function creerQR(invitation) {

    const qrContainer = document.getElementById("qrCreation");

    if (!qrContainer) return;

    qrContainer.innerHTML = "";

    const qrData = donneesQR(invitation);

    new QRCode(qrContainer, {

        text: qrData,

        width: 220,

        height: 220,

        colorDark: "#000000",

        colorLight: "#ffffff",

        correctLevel: QRCode.CorrectLevel.H

    });
}


// ============================================================
// FORMULAIRE DE CREATION
// ============================================================

const invitationForm = document.getElementById("invitationForm");

if (invitationForm) {

    invitationForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const bouton = invitationForm.querySelector(
            'button[type="submit"]'
        );

        try {

            bouton.disabled = true;

            bouton.textContent = "Vérification...";

            afficherMessage(
                "Vérification des informations...",
                "info"
            );


            // ------------------------------------------------
            // RECUPERATION DES INFORMATIONS
            // ------------------------------------------------

            const nom = document
                .getElementById("nom")
                .value
                .trim();

            const telephone = document
                .getElementById("telephone")
                .value
                .trim();

            const personnes = Number(
                document.getElementById("personnes").value
            );

            const type = document
                .getElementById("type")
                .value;

            const table = document
                .getElementById("table")
                .value
                .trim();


            // ------------------------------------------------
            // VERIFICATIONS
            // ------------------------------------------------

            if (!nom) {

                throw new Error(
                    "Veuillez entrer le nom de l'invité."
                );
            }

            if (!telephone) {

                throw new Error(
                    "Veuillez entrer le numéro de téléphone."
                );
            }

            if (!personnes || personnes < 1) {

                throw new Error(
                    "Le nombre de personnes est incorrect."
                );
            }

            if (!type) {

                throw new Error(
                    "Veuillez choisir le type d'invitation."
                );
            }

            if (!table) {

                throw new Error(
                    "Veuillez entrer la table."
                );
            }


            // ------------------------------------------------
            // NORMALISATION
            // ------------------------------------------------

            const nomNormalise = normaliserNom(nom);

            const telephoneNormalise =
                normaliserTelephone(telephone);

            const duplicateKey =
                creerCleDoublon(nom, telephone);


            // ------------------------------------------------
            // PREMIERE VERIFICATION
            //
            // Elle permet également de détecter les anciennes
            // invitations créées avec l'ancien système.
            // ------------------------------------------------

            bouton.textContent = "Recherche des doublons...";

            const doublonQuery = query(

                invitationsRef,

                where(
                    "nomNormalise",
                    "==",
                    nomNormalise
                ),

                where(
                    "telephoneNormalise",
                    "==",
                    telephoneNormalise
                )
            );


            const doublons = await getDocs(doublonQuery);


            if (!doublons.empty) {

                throw new Error(
                    "DUPLICATE_INVITATION"
                );
            }


            // ------------------------------------------------
            // REFERENCE FIRESTORE DETERMINISTE
            //
            // Très important :
            //
            // Deux téléphones qui essayent exactement au même
            // moment de créer la même invitation vont utiliser
            // exactement le même document Firestore.
            //
            // La transaction garantit qu'un seul pourra le créer.
            // ------------------------------------------------

            const invitationRef = doc(
                db,
                "invitations",
                duplicateKey
            );


            // ------------------------------------------------
            // GENERATION DE L'INVITATION
            // ------------------------------------------------

            const invitation = {

                code: genererCodeUnique(),

                nom: nom,

                telephone: telephone,

                personnes: personnes,

                type: type,

                table: table,

                dateCreation:
                    new Date().toISOString(),

                utilise: false,

                dateUtilisation: null,

                // Informations utilisées pour détecter
                // les doublons.

                nomNormalise: nomNormalise,

                telephoneNormalise: telephoneNormalise,

                duplicateKey: duplicateKey

            };


            bouton.textContent = "Création sécurisée...";


            // ------------------------------------------------
            // TRANSACTION ATOMIQUE
            // ------------------------------------------------

            await runTransaction(
                db,
                async transaction => {

                    const documentExistant =
                        await transaction.get(
                            invitationRef
                        );


                    // Si le document existe déjà,
                    // l'invitation existe déjà.

                    if (documentExistant.exists()) {

                        throw new Error(
                            "DUPLICATE_INVITATION"
                        );
                    }


                    // Création du document.

                    transaction.set(
                        invitationRef,
                        invitation
                    );
                }
            );


            // ------------------------------------------------
            // AJOUT DE L'ID DU DOCUMENT
            // ------------------------------------------------

            invitation.id = duplicateKey;


            // ------------------------------------------------
            // AFFICHAGE DU QR
            // ------------------------------------------------

            creerQR(invitation);


            afficherMessage(
                "Invitation créée avec succès.",
                "success"
            );


            // ------------------------------------------------
            // NETTOYAGE DU FORMULAIRE
            // ------------------------------------------------

            invitationForm.reset();

            document.getElementById("personnes").value = 1;


            // ------------------------------------------------
            // RETOUR AU BOUTON NORMAL
            // ------------------------------------------------

            bouton.disabled = false;

            bouton.textContent =
                "Générer l'invitation";


            // Actualisation de la liste.

            afficherListe();

        }

        catch (error) {

            console.error(
                "Erreur création invitation :",
                error
            );


            // ------------------------------------------------
            // DOUBLON
            // ------------------------------------------------

            if (
                error.message ===
                "DUPLICATE_INVITATION"
            ) {

                afficherMessage(
                    "Cette personne possède déjà une invitation avec ce numéro de téléphone.",
                    "error"
                );

            }

            else {

                afficherMessage(
                    "Impossible de créer l'invitation : " +
                    error.message,
                    "error"
                );
            }


            bouton.disabled = false;

            bouton.textContent =
                "Générer l'invitation";
        }

    });
}


// ============================================================
// AFFICHAGE DE LA LISTE
// ============================================================

async function afficherListe() {

    const container =
        document.getElementById(
            "listeInvitations"
        );

    if (!container) return;


    container.innerHTML =
        "<p>Chargement des invitations...</p>";


    try {

        const q = query(
            invitationsRef,
            orderBy(
                "dateCreation",
                "desc"
            )
        );


        const snapshot =
            await getDocs(q);


        if (snapshot.empty) {

            container.innerHTML =
                "<p>Aucune invitation enregistrée.</p>";

            return;
        }


        let html = "";


        snapshot.forEach(documentSnapshot => {

            const invitation =
                documentSnapshot.data();

            invitation.id =
                documentSnapshot.id;


            const statut =
                invitation.utilise
                    ? "Utilisée"
                    : "Valide";


            const boutonAction =
                invitation.utilise

                    ? `
                        <button
                            class="secondary reactiver-btn"
                            data-id="${escapeHtml(invitation.id)}">
                            Réactiver
                        </button>
                    `

                    : "";


            html += `

                <div class="invitation-item">

                    <div class="invitation-info">

                        <h3>
                            ${escapeHtml(invitation.nom)}
                        </h3>

                        <p>
                            Téléphone :
                            ${escapeHtml(invitation.telephone)}
                        </p>

                        <p>
                            Personnes :
                            ${escapeHtml(invitation.personnes)}
                        </p>

                        <p>
                            Type :
                            ${escapeHtml(invitation.type)}
                        </p>

                        <p>
                            Table :
                            ${escapeHtml(invitation.table)}
                        </p>

                        <p>
                            Statut :
                            <strong>
                                ${statut}
                            </strong>
                        </p>

                    </div>


                    <div class="invitation-actions">

                        <button
                            class="primary export-qr-btn"
                            data-id="${escapeHtml(invitation.id)}">
                            Exporter QR
                        </button>

                        ${boutonAction}

                        <button
                            class="danger supprimer-btn"
                            data-id="${escapeHtml(invitation.id)}">
                            Supprimer
                        </button>

                    </div>

                </div>

            `;
        });


        container.innerHTML = html;


        // ----------------------------------------------------
        // BOUTONS EXPORT
        // ----------------------------------------------------

        document
            .querySelectorAll(".export-qr-btn")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function() {

                        exporterQR(
                            this.dataset.id
                        );

                    }
                );

            });


        // ----------------------------------------------------
        // BOUTONS SUPPRESSION
        // ----------------------------------------------------

        document
            .querySelectorAll(".supprimer-btn")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function() {

                        supprimerInvitation(
                            this.dataset.id
                        );

                    }
                );

            });


        // ----------------------------------------------------
        // BOUTONS REACTIVATION
        // ----------------------------------------------------

        document
            .querySelectorAll(".reactiver-btn")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function() {

                        reactiverInvitation(
                            this.dataset.id
                        );

                    }
                );

            });

    }

    catch (error) {

        console.error(
            "Erreur liste :",
            error
        );

        container.innerHTML =
            "<p>Erreur lors du chargement des invitations.</p>";
    }
}


// ============================================================
// SUPPRIMER UNE INVITATION
// ============================================================

async function supprimerInvitation(id) {

    const confirmation =
        confirm(
            "Voulez-vous vraiment supprimer cette invitation ?"
        );


    if (!confirmation) return;


    try {

        await deleteDoc(
            doc(
                db,
                "invitations",
                id
            )
        );


        afficherListe();

    }

    catch (error) {

        console.error(
            "Erreur suppression :",
            error
        );

        alert(
            "Impossible de supprimer cette invitation."
        );
    }
}


// ============================================================
// REACTIVER UNE INVITATION
// ============================================================

async function reactiverInvitation(id) {

    try {

        await updateDoc(

            doc(
                db,
                "invitations",
                id
            ),

            {

                utilise: false,

                dateUtilisation: null

            }

        );


        afficherListe();

    }

    catch (error) {

        console.error(
            "Erreur réactivation :",
            error
        );

        alert(
            "Impossible de réactiver cette invitation."
        );
    }
}


// ============================================================
// EXPORTER LE QR CODE
// ============================================================

async function exporterQR(id) {

    try {

        const snapshot =
            await getDoc(
                doc(
                    db,
                    "invitations",
                    id
                )
            );


        if (!snapshot.exists()) {

            alert(
                "Invitation introuvable."
            );

            return;
        }


        const invitation =
            snapshot.data();


        const zoneTemporaire =
            document.createElement("div");


        zoneTemporaire.style.position =
            "fixed";

        zoneTemporaire.style.left =
            "-10000px";

        zoneTemporaire.style.top =
            "0";

        zoneTemporaire.style.background =
            "#ffffff";

        zoneTemporaire.style.padding =
            "30px";

        zoneTemporaire.style.width =
            "300px";

        document.body.appendChild(
            zoneTemporaire
        );


        new QRCode(
            zoneTemporaire,
            {

                text: donneesQR({
                    ...invitation,
                    id: id
                }),

                width: 260,

                height: 260,

                colorDark: "#000000",

                colorLight: "#ffffff",

                correctLevel:
                    QRCode.CorrectLevel.H

            }
        );


        // Attendre que QRCode.js crée le canvas.

        setTimeout(() => {

            const canvas =
                zoneTemporaire.querySelector(
                    "canvas"
                );


            if (!canvas) {

                alert(
                    "Impossible de générer le QR."
                );

                zoneTemporaire.remove();

                return;
            }


            const lien =
                document.createElement("a");


            lien.download =
                "QR-" +
                invitation.nom
                    .replace(/\s+/g, "-") +
                ".png";


            lien.href =
                canvas.toDataURL(
                    "image/png"
                );


            lien.click();


            zoneTemporaire.remove();

        }, 300);

    }

    catch (error) {

        console.error(
            "Erreur export QR :",
            error
        );

        alert(
            "Impossible d'exporter le QR."
        );
    }
}


// ============================================================
// SCANNER
// ============================================================

let scanner = null;

let scannerEnCours = false;


// ============================================================
// DEMARRER CAMERA
// ============================================================

const startCamera =
    document.getElementById(
        "startCamera"
    );


if (startCamera) {

    startCamera.addEventListener(
        "click",
        async function() {

            try {

                if (scannerEnCours) {
                    return;
                }


                scanner =
                    new Html5Qrcode(
                        "reader"
                    );


                await scanner.start(

                    {
                        facingMode:
                            "environment"
                    },

                    {
                        fps: 10,

                        qrbox: {
                            width: 250,
                            height: 250
                        }

                    },

                    decodedText => {

                        traiterQR(
                            decodedText
                        );

                    },

                    errorMessage => {
                        // Les erreurs de lecture normales
                        // sont ignorées.
                    }

                );


                scannerEnCours = true;


                afficherScannerMessage(
                    "Caméra démarrée.",
                    "success"
                );

            }

            catch (error) {

                console.error(
                    "Erreur caméra :",
                    error
                );

                afficherScannerMessage(
                    "Impossible d'accéder à la caméra.",
                    "error"
                );
            }

        }
    );
}


// ============================================================
// ARRETER CAMERA
// ============================================================

const stopCamera =
    document.getElementById(
        "stopCamera"
    );


if (stopCamera) {

    stopCamera.addEventListener(
        "click",
        async function() {

            await arreterScanner();

        }
    );
}


async function arreterScanner() {

    if (
        scanner &&
        scannerEnCours
    ) {

        try {

            await scanner.stop();

            scanner.clear();

        }

        catch (error) {

            console.error(
                "Erreur arrêt scanner :",
                error
            );
        }

        scannerEnCours = false;
    }
}


// ============================================================
// SCAN D'UNE PHOTO
// ============================================================

const qrPhoto =
    document.getElementById(
        "qrPhoto"
    );


if (qrPhoto) {

    qrPhoto.addEventListener(
        "change",
        async function(event) {

            const fichier =
                event.target.files[0];


            if (!fichier) return;


            try {

                const lecteur =
                    new Html5Qrcode(
                        "reader"
                    );


                const resultat =
                    await lecteur.scanFile(
                        fichier,
                        true
                    );


                await lecteur.clear();


                traiterQR(
                    resultat
                );

            }

            catch (error) {

                console.error(
                    "Erreur lecture photo :",
                    error
                );

                afficherScannerMessage(
                    "Aucun QR code valide trouvé dans cette photo.",
                    "error"
                );
            }

        }
    );
}


// ============================================================
// TRAITER LE QR
// ============================================================

async function traiterQR(texteQR) {

    try {

        await arreterScanner();


        let data;


        try {

            data =
                JSON.parse(
                    texteQR
                );

        }

        catch {

            afficherResultatRefuse(
                "QR code invalide."
            );

            return;
        }


        if (
            !data.code &&
            !data.id
        ) {

            afficherResultatRefuse(
                "QR code d'invitation invalide."
            );

            return;
        }


        await verifierInvitation(
            data
        );

    }

    catch (error) {

        console.error(
            "Erreur traitement QR :",
            error
        );

        afficherResultatRefuse(
            "Erreur pendant la vérification."
        );
    }
}


// ============================================================
// VERIFIER ET UTILISER L'INVITATION
// ============================================================

async function verifierInvitation(dataQR) {

    try {

        let invitationRef = null;


        // ----------------------------------------------------
        // NOUVEAUX QR :
        // ils possèdent directement l'ID Firestore.
        // ----------------------------------------------------

        if (dataQR.id) {

            invitationRef =
                doc(
                    db,
                    "invitations",
                    dataQR.id
                );

        }

        // ----------------------------------------------------
        // ANCIENS QR :
        // recherche par code.
        // ----------------------------------------------------

        else if (dataQR.code) {

            const recherche =
                query(
                    invitationsRef,
                    where(
                        "code",
                        "==",
                        dataQR.code
                    )
                );


            const resultat =
                await getDocs(
                    recherche
                );


            if (resultat.empty) {

                afficherResultatRefuse(
                    "Invitation introuvable."
                );

                return;
            }


            invitationRef =
                doc(
                    db,
                    "invitations",
                    resultat.docs[0].id
                );
        }


        if (!invitationRef) {

            afficherResultatRefuse(
                "Invitation invalide."
            );

            return;
        }


        // ----------------------------------------------------
        // TRANSACTION ATOMIQUE
        //
        // Si deux téléphones scannent exactement le même QR
        // au même moment, un seul pourra le valider.
        // ----------------------------------------------------

        let invitationValidee = null;


        await runTransaction(
            db,
            async transaction => {

                const snapshot =
                    await transaction.get(
                        invitationRef
                    );


                if (!snapshot.exists()) {

                    throw new Error(
                        "NOT_FOUND"
                    );
                }


                const invitation =
                    snapshot.data();


                // ------------------------------------------------
                // QR DEJA UTILISE
                // ------------------------------------------------

                if (invitation.utilise === true) {

                    throw new Error(
                        "ALREADY_USED"
                    );
                }


                // ------------------------------------------------
                // VALIDATION
                // ------------------------------------------------

                const maintenant =
                    new Date().toISOString();


                transaction.update(

                    invitationRef,

                    {

                        utilise: true,

                        dateUtilisation:
                            maintenant

                    }

                );


                invitationValidee = {

                    ...invitation,

                    id:
                        snapshot.id,

                    utilise: true,

                    dateUtilisation:
                        maintenant

                };

            }
        );


        // ----------------------------------------------------
        // AFFICHER RESULTAT
        // ----------------------------------------------------

        afficherResultat(
            invitationValidee
        );


        afficherScannerMessage(
            "Invitation validée.",
            "success"
        );

    }

    catch (error) {

        console.error(
            "Erreur vérification :",
            error
        );


        if (
            error.message ===
            "ALREADY_USED"
        ) {

            afficherResultatRefuse(
                "Cette invitation a déjà été utilisée."
            );

            return;
        }


        if (
            error.message ===
            "NOT_FOUND"
        ) {

            afficherResultatRefuse(
                "Invitation introuvable."
            );

            return;
        }


        afficherResultatRefuse(
            "Impossible de vérifier cette invitation."
        );
    }
}


// ============================================================
// AFFICHER RESULTAT VALIDE
// ============================================================

function afficherResultat(invitation) {

    const resultat =
        document.getElementById(
            "resultat"
        );

    const informations =
        document.getElementById(
            "informationsInvitation"
        );


    if (!resultat || !informations) {
        return;
    }


    resultat.style.display =
        "block";


    informations.innerHTML = `

        <div class="verification-title">
            Invitation validée
        </div>

        <div class="info-box">

            <div class="info-line">
                <strong>Nom</strong>
                <span>
                    ${escapeHtml(invitation.nom)}
                </span>
            </div>

            <div class="info-line">
                <strong>Téléphone</strong>
                <span>
                    ${escapeHtml(invitation.telephone)}
                </span>
            </div>

            <div class="info-line">
                <strong>Nombre de personnes</strong>
                <span>
                    ${escapeHtml(invitation.personnes)}
                </span>
            </div>

            <div class="info-line">
                <strong>Type d'invitation</strong>
                <span>
                    ${escapeHtml(invitation.type)}
                </span>
            </div>

            <div class="info-line">
                <strong>Table</strong>
                <span>
                    ${escapeHtml(invitation.table)}
                </span>
            </div>

            <div class="info-line">
                <strong>Code</strong>
                <span>
                    ${escapeHtml(invitation.code)}
                </span>
            </div>

            <div class="info-line">
                <strong>Date de création</strong>
                <span>
                    ${formatDate(invitation.dateCreation)}
                </span>
            </div>

            <div class="info-line">
                <strong>Date d'utilisation</strong>
                <span>
                    ${formatDate(invitation.dateUtilisation)}
                </span>
            </div>

            <div class="info-line">
                <strong>Statut</strong>
                <span class="status-valid">
                    Invitation valide
                </span>
            </div>

        </div>

    `;
}


// ============================================================
// RESULTAT REFUSE
// ============================================================

function afficherResultatRefuse(message) {

    const resultat =
        document.getElementById(
            "resultat"
        );

    const informations =
        document.getElementById(
            "informationsInvitation"
        );


    if (!resultat || !informations) {
        return;
    }


    resultat.style.display =
        "block";


    informations.innerHTML = `

        <div class="verification-title">
            Invitation refusée
        </div>

        <div class="info-box">

            <div class="info-line">

                <strong>Statut</strong>

                <span style="color:#dc3545;font-weight:bold;">
                    ${escapeHtml(message)}
                </span>

            </div>

        </div>

    `;
}


// ============================================================
// MESSAGE SCANNER
// ============================================================

function afficherScannerMessage(
    message,
    type = "info"
) {

    const element =
        document.getElementById(
            "scannerMessage"
        );


    if (!element) return;


    element.innerHTML = `

        <div class="message ${type}">
            ${escapeHtml(message)}
        </div>

    `;
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(date) {

    if (!date) {
        return "-";
    }


    try {

        return new Date(
            date
        ).toLocaleString(
            "fr-FR"
        );

    }

    catch {

        return date;
    }
}


// ============================================================
// SYNCHRONISATION AUTOMATIQUE FIRESTORE
// ============================================================

if (
    document.getElementById(
        "listeInvitations"
    )
) {

    const q = query(
        invitationsRef,
        orderBy(
            "dateCreation",
            "desc"
        )
    );


    onSnapshot(

        q,

        snapshot => {

            afficherListe();

        },

        error => {

            console.error(
                "Erreur synchronisation Firestore :",
                error
            );

        }

    );
}