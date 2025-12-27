import admin from 'firebase-admin';
import { config } from 'dotenv';

config();

const serviceAccount = {
 
}
;

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export const auth = admin.auth();
