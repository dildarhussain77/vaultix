import { bufferToBase64, base64ToBuffer } from './crypto';

const BIOMETRIC_KEY = (userId: string) => `vaultix_biometric_${userId}`;

export interface BiometricConfig {
    enabled: boolean;
    credentialId: string;
}

/** Check if the current device has biometric hardware (Face/Fingerprint) */
export async function isBiometricsAvailable(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

/** Get local biometric status for the user */
export function getBiometricConfig(userId: string): BiometricConfig | null {
    const data = localStorage.getItem(BIOMETRIC_KEY(userId));
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/** Remove biometric enrollment from this device */
export function disableBiometrics(userId: string): void {
    localStorage.removeItem(BIOMETRIC_KEY(userId));
}

/** Register the device's Face/Fingerprint with Vaultix */
export async function registerBiometrics(userId: string, userEmail: string): Promise<boolean> {
    if (!window.PublicKeyCredential) {
        throw new Error("Biometrics not supported in this browser.");
    }

    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: {
                name: "Vaultix",
                id: window.location.hostname
            },
            user: {
                id: userIdBuffer,
                name: userEmail,
                displayName: userEmail
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" },  // ES256
                { alg: -257, type: "public-key" } // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // Enforces device biometric (Face/Fingerprint)
                userVerification: "required"
            },
            timeout: 60000
        }
    }) as PublicKeyCredential | null;

    if (!credential) {
        throw new Error("Failed to register biometrics.");
    }

    const config: BiometricConfig = {
        enabled: true,
        credentialId: bufferToBase64(new Uint8Array(credential.rawId))
    };

    localStorage.setItem(BIOMETRIC_KEY(userId), JSON.stringify(config));
    return true;
}

/** Prompt the device's Face/Fingerprint on Unlock */
export async function verifyBiometrics(userId: string): Promise<boolean> {
    const config = getBiometricConfig(userId);
    if (!config || !config.enabled) return true; // Biometrics not enabled on this device

    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const credIdBuffer = base64ToBuffer(config.credentialId);

    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                allowCredentials: [{
                    id: credIdBuffer as BufferSource,
                    type: "public-key"
                }],
                userVerification: "required", // Triggers Face ID / Fingerprint
                timeout: 60000
            }
        });

        return !!assertion;
    } catch (err: any) {
        console.error("Biometric verification failed:", err);
        return false;
    }
}
