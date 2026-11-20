/* =========================================================================
   CONSENT.JS — Data privacy notice and terms of service
   -------------------------------------------------------------------------
   The registration form and every student account share one policy text and
   one acceptance flag. Acceptance is stored per student account in
   localStorage under `ucc_consent_v1_<userId>`, so a student who closes the
   page without agreeing is asked again on the next visit. Changing
   CONSENT_VERSION asks every student to read the updated version once more.
   ========================================================================= */

export const CONSENT_VERSION = '1';
export const CONSENT_EFFECTIVE = 'November 20, 2026';

const STORE_PREFIX = 'ucc_consent_v1_';

export function hasAcceptedConsent(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(STORE_PREFIX + String(userId)) === CONSENT_VERSION;
  } catch (e) {
    return false;
  }
}

export function acceptConsent(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(STORE_PREFIX + String(userId), CONSENT_VERSION);
  } catch (e) {
    // Storage is blocked: the notice simply shows again on the next visit.
  }
}

/* The policy text, shared by the registration window and the student gate. */
const policyBody = () => `
  <div class="consent-meta">Effective ${CONSENT_EFFECTIVE} · Version ${CONSENT_VERSION}</div>

  <h4>1. Who this notice covers</h4>
  <p>This notice explains how Unida Christian Colleges ("UCC", "the school") handles the
  personal information you give the Enrollment Portal, and the terms you accept when you
  use it. It applies to applicants, students and anyone who creates an account.</p>

  <h4>2. Information we collect</h4>
  <ul>
    <li><strong>Account details:</strong> your full name, email address and password.</li>
    <li><strong>Application details:</strong> personal information (contact number, address),
    educational background, and the degree program and year level you apply for.</li>
    <li><strong>Documents you upload:</strong> Form 138 or transcript of records, PSA birth
    certificate, certificate of good moral character, identification photo, entrance exam
    result, and other records the enrollment process requires.</li>
    <li><strong>Enrollment and financial records:</strong> the subjects assigned to you, your
    assessed fees, payments made and their reference numbers.</li>
  </ul>

  <h4>3. How we use it</h4>
  <p>Your information is used only for school purposes: to evaluate your application, verify
  your documents, assign your subject load, assess and collect fees, issue your student ID and
  registration form, keep your academic record, and communicate with you about enrollment.</p>

  <h4>4. Who can see it</h4>
  <p>Access is limited to school offices that need the information for their work:</p>
  <ul>
    <li><strong>Registrar</strong> — reviews applications, verifies documents and maintains academic records.</li>
    <li><strong>Accounting</strong> — assesses fees, records payments and issues receipts.</li>
    <li><strong>Faculty</strong> — sees the students officially enrolled in their classes.</li>
    <li><strong>Administrator</strong> — manages accounts and system settings.</li>
  </ul>
  <p>We do not sell your information and do not share it with outside parties, except when the
  law or a lawful order requires it.</p>

  <h4>5. How we protect and keep it</h4>
  <p>Accounts are protected by a password, uploaded files are kept in the school's private
  storage, and records are accessible only through the roles listed above. Your records are
  kept for as long as you have an enrollment relationship with UCC and for the retention period
  the school and Philippine law require, then securely disposed of.</p>

  <h4>6. Your rights</h4>
  <p>Under the Data Privacy Act of 2012 (Republic Act No. 10173) you may ask to be informed
  about how your data is processed, to access and correct it, to object to processing, to have
  it erased or blocked when there is a lawful basis, and to be compensated for damages caused
  by unauthorized processing. Requests may be raised with the Registrar's Office or the school's
  Data Protection Officer.</p>

  <h4>7. Terms of service</h4>
  <ul>
    <li><strong>Accurate information.</strong> The details you enter must be true and complete.
    False or incomplete entries can void your application or enrollment.</li>
    <li><strong>Genuine documents.</strong> Upload only authentic documents that belong to you.
    Falsified or borrowed documents are grounds for rejection and disciplinary action.</li>
    <li><strong>Your account.</strong> Keep your password private and do not let anyone else use
    your account. You are responsible for the activity under it.</li>
    <li><strong>Acceptable use.</strong> Do not attempt to access other students' records,
    disrupt the portal, or use it for anything other than your own enrollment.</li>
    <li><strong>Fees and payments.</strong> Assessed fees follow the current fee settings.
    Payments recorded in the portal are reflected in your student account and receipt.</li>
    <li><strong>Changes.</strong> The school may update this notice and these terms. You will be
    asked to read and accept a new version before continuing to use the portal.</li>
  </ul>

  <h4>8. Giving your consent</h4>
  <p>By ticking the box in the registration window, you confirm that you have read this notice
  and these terms, that you understand them, and that you freely give your consent to the
  processing described above. For a student account, the same agreement is required before the
  portal can be used. You may withdraw your consent at any time, but the school may then be
  unable to process your application or enrollment.</p>
`;

/* The window shown from inside the registration form. Read-only: it closes. */
export function consentDocHTML() {
  return `
    <div class="rp-modal-backdrop" id="consentDocModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>Data Privacy Notice and Terms of Service</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('consentDocModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body consent-doc">${policyBody()}</div>
        <div class="rp-modal-foot">
          <button type="button" class="rp-btn rp-btn-ghost" onclick="document.getElementById('consentDocModal').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
}

/* The gate a student must answer before the portal is usable. */
export function consentGateHTML() {
  return `
    <div class="rp-modal-backdrop" id="consentGate" data-sticky="1">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>Data Privacy Notice and Terms of Service</h3>
        </div>
        <div class="rp-modal-body consent-doc">${policyBody()}</div>
        <div class="rp-modal-foot consent-gate-foot">
          <button type="button" class="rp-btn rp-btn-primary" data-action="acceptConsent">I Agree and Continue</button>
          <button type="button" class="rp-btn rp-btn-ghost" data-action="declineConsent">Sign Out</button>
        </div>
      </div>
    </div>
  `;
}

export function openConsentDoc() {
  document.getElementById('consentDocModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', consentDocHTML());
}
