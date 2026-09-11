import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Shield, 
  KeyRound, 
  FileText, 
  Fingerprint, 
  Download, 
  Upload, 
  Clock, 
  Smartphone, 
  WifiOff, 
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  Lock,
  Bell
} from 'lucide-react';

export default function SecurityGuide() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '1rem 0.85rem 4rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Navigation Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '0.75rem',
          marginBottom: '1.5rem', 
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '0.75rem' 
        }}>
          <button 
            onClick={() => navigate('/settings')} 
            className="btn-secondary" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              padding: '0.4rem 0.75rem', 
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={15} /> Back to Settings
          </button>
          <span style={{ 
            fontSize: '0.72rem', 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em',
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            Docs & Security
          </span>
        </div>

        {/* Document Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-teal)', marginBottom: '0.4rem' }}>
            <Shield size={18} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Zero-Knowledge Protection
            </span>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.45rem', lineHeight: 1.3 }}>
            Security & User Guide
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            A complete, plain-English reference guide on how Vaultix works, how your secrets stay safe, and how to recover your data under any circumstance.
          </p>
        </div>

        {/* Continuous Flow Document */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: 1.6 }}>

          {/* 1. What is Zero-Knowledge */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <Shield size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                1. What is Zero-Knowledge Protection?
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Vaultix is engineered on the <strong>Zero-Knowledge</strong> principle. This means you alone possess the keys to read your data.
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Before any password, note, token, or title leaves your device, it is encrypted locally using the military-grade <strong>AES-GCM 256-bit</strong> algorithm. The cloud database only holds meaningless scrambled cipher text. Neither the creators of Vaultix, nor database administrators, nor hackers can read your passwords.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 2. Master Password Flow */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <KeyRound size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                2. Your Master Password
              </h2>
            </div>
            
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              When is it created?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              When you sign up as a new user, Vaultix immediately guides you through the <strong>Vault Setup</strong> screen. Here, you choose your Master Password. This is separate from your account login email.
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Where is it stored?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              <strong>It is never stored anywhere.</strong> It is not saved in any database, cookie, or file. It only lives temporarily in your device's active memory while the vault is unlocked. When you lock the vault or close the app, it is wiped completely.
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              What if you forget your Master Password?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Because we don't know your password, there is no "Forgot Password" email link. If you forget it, your <strong>12-word Recovery Phrase</strong> is the only key to regain access and set a new Master Password.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 3. Emergency 12-Word Recovery Phrase */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <FileText size={18} color="#c084fc" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                3. The 12-Word Emergency Recovery Phrase
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              During initial setup, Vaultix generates 12 random words. This phrase holds the mathematical power to re-derive your master encryption key.
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              How to Recover Your Vault:
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              If you forget your Master Password:
            </p>
            <ol style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.85rem' }}>
              <li>On the Unlock screen, tap <strong>"Forgot Master Password? Recover Vault"</strong>.</li>
              <li>Enter your 12 recovery words in exact order.</li>
              <li>Type in your new Master Password and confirm it.</li>
              <li>Your vault will decrypt and update your master key immediately.</li>
            </ol>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              How & When to Regenerate a New Phrase:
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              If you lost the paper where you wrote your 12 words, or suspect someone saw it, you can generate a brand new one while your vault is still open:
            </p>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem', borderLeft: '2px solid var(--accent-teal)', marginBottom: '0.65rem' }}>
              <strong>Settings &gt; Backup & Recovery &gt; Regenerate Phrase</strong>
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              This produces 12 new words, updates the cloud recovery lock, and renders your old 12 words completely useless. Always write down the new words immediately.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 4. Export & Import Backups */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <Download size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                4. Backup Export & Restore (.json)
              </h2>
            </div>
            
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Is the exported file safe?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              <strong>Yes, 100% safe.</strong> When you tap <strong>"Export Backup"</strong>, the downloaded <code>vaultix-backup-*.json</code> file does NOT contain plain text passwords or secrets. Every single item inside remains locked under your zero-knowledge AES-256 encryption. If someone finds or steals this JSON file, they cannot open or read anything without your Master Password.
            </p>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              How to use the backup file:
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Keep this JSON file on a USB drive, external hard drive, or private cloud. If you ever want to restore your data on a clean device or recover deleted folders:
            </p>
            <ol style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>Open Vaultix and navigate to <strong>Settings</strong>.</li>
              <li>Under Backup & Recovery, tap <strong>"Import Backup"</strong>.</li>
              <li>Select your saved <code>.json</code> file.</li>
              <li>Vaultix automatically merges and restores all folders and encrypted credentials.</li>
            </ol>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 5. Device Lost or Changing Phones */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <Smartphone size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                5. What if You Lose Your Phone or Buy a New Device?
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              Because your encrypted vault syncs securely to your cloud account:
            </p>
            <ol style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.85rem' }}>
              <li>Take your new phone or computer and open <strong>Vaultix</strong>.</li>
              <li>Sign in with your email and account password.</li>
              <li><strong>Two-Step Verification:</strong> Because Vaultix detects a new device, it will send a 6-digit verification code to your email. Enter this code to verify your identity.</li>
              <li>Enter your <strong>Master Password</strong> to decrypt your vault.</li>
              <li>Go to <strong>Settings</strong> and turn on <strong>Device Biometrics</strong> to pair your new phone's fingerprint or face sensor.</li>
              <li>Under <strong>Logged-in Devices</strong>, you can tap <strong>"Log out"</strong> next to your old or lost phone to remotely revoke its access.</li>
            </ol>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Note: Biometrics are tied to individual hardware. Turning on fingerprint on your phone does not affect your laptop; you can enable it on each device separately.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 6. Biometrics (Fingerprint / Face ID) */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <Fingerprint size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                6. Device Biometrics Security
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              When you enable biometrics in <strong>Settings</strong>, your device creates a secure hardware key in its biometric enclave (WebAuthn).
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              This provides <strong>Two-Factor Physical Protection</strong>: to unlock on this device, a user needs both the knowledge factor (Master Password) and the physical presence factor (your finger or face).
            </p>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              If your phone has both Face and Fingerprint, Android typically uses Class 3 hardware fingerprint sensors for cryptographic WebAuthn, while Apple iOS devices use native 3D Face ID.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 7. Auto-Lock & Clipboard Shield */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <Clock size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                7. Auto-Lock & 60-Second Clipboard Shield
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              <strong>5-Minute Inactivity Lock:</strong> If you leave Vaultix open without touching it for 5 minutes, it automatically locks itself and wipes the encryption key from RAM.
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              <strong>60-Second Clipboard Clear:</strong> When you tap to copy any secret or password, Vaultix starts a 60-second timer. Once 60 seconds pass, the copied password is automatically wiped from your clipboard so other websites, apps, or people cannot paste it.
            </p>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Tip: Whenever you finish copying and using a password, it is good practice to return to Vaultix and tap <strong>"Lock Vault"</strong> to immediately wipe your keys and clipboard.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 8. 100% Offline Capability */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <WifiOff size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                8. Works 100% Offline
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Vaultix caches your encrypted vault inside your device's private IndexedDB storage. If you lose internet access, get on a flight, or are traveling, you can still open Vaultix, enter your Master Password, and access all your credentials without network connectivity.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* 9. Security Notifications */}
          <section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.5rem' }}>
              <Bell size={18} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                9. Real-Time Security Notifications
              </h2>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              You can enable native system notifications directly from <strong>Settings &gt; Alerts &amp; Notifications</strong>.
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Vaultix uses your operating system's built-in Notification API (zero third-party tracking) to deliver immediate alerts whenever your vault is unlocked or credentials are created, updated, or removed.
            </p>
          </section>

        </div>

        {/* Bottom Back Button */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <button 
            onClick={() => navigate('/settings')} 
            className="btn-primary"
            style={{ padding: '0.65rem 1.75rem', fontSize: '0.88rem', borderRadius: 'var(--radius-sm)' }}
          >
            Back to Settings
          </button>
        </div>

      </div>
    </div>
  );
}

