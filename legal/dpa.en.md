# Data Processing Agreement (DPA) — Talmate Limited (Processor)

**Last updated:** 2026-04-01  
**Version:** 0.1 (draft)  

This Data Processing Agreement (“**DPA**”) forms part of the agreement between **Talmate Limited** (“**Processor**”, “**Talmate**”) and the customer using the Platform (“**Controller**”, “**Customer**”), governing Processing of Personal Data by Processor on behalf of Controller.

Where required, this DPA is intended to satisfy Article 28 GDPR / UK GDPR requirements, and to support comparable obligations for processing involving individuals in Argentina (Law 25,326).

## 1. Definitions
Terms such as “Personal Data”, “Processing”, “Controller”, “Processor”, “Data Subject”, “Personal Data Breach” have the meanings set out in applicable data protection laws (GDPR/UK GDPR and, where applicable, Argentine law).

## 2. Scope and roles
2.1 **Controller** determines the purposes of Processing of the Customer’s leads/contacts and communications.  
2.2 **Processor** processes Personal Data on behalf of Controller to provide the Platform.

> Note on AI qualification: the Platform includes AI-based qualification flows designed and maintained by Talmate. The parties acknowledge that certain technical means may be determined by Processor, while Processing is still performed to provide the services to Controller under this DPA.

## 3. Processor obligations
Processor will:
- process Personal Data only on documented instructions from Controller, including as necessary to provide the services
- ensure persons authorised to process Personal Data are bound by confidentiality
- implement appropriate technical and organisational measures (“TOMs”)
- assist Controller with Data Subject requests (to the extent legally required and practicable)
- assist with security, breach notifications, and DPIAs/consultations where required
- at Controller’s choice, delete or return Personal Data at the end of the services (subject to legal retention)
- make available information reasonably necessary to demonstrate compliance, and allow audits as set out below

## 4. Controller obligations
Controller is responsible for:
- having a lawful basis to contact leads and process their data
- providing required notices to Data Subjects
- ensuring instructions are lawful
- managing consent/opt-out where required (marketing, tracking, call recording notices, etc.)
- configuring and using the Platform in compliance with applicable law and third-party terms (WhatsApp/Twilio/Whapi, etc.)

## 5. Sub-processing
5.1 Controller authorises Processor to appoint Sub-processors to deliver the services.  
5.2 Processor will maintain a list of Sub-processors and will notify Controller of material changes where feasible.  
5.3 Processor will impose data protection obligations on Sub-processors no less protective than this DPA.

Indicative Sub-processor list: see `legal/subprocessors.md`.

## 6. International transfers
Where Processing involves transfers of Personal Data outside the UK/EEA, Processor will use appropriate safeguards, such as:
- EU Standard Contractual Clauses (SCCs)
- UK IDTA and/or the UK Addendum to SCCs
and any supplementary measures where required.

For Argentina-related transfers, the parties will apply safeguards required under applicable Argentine rules.

## 7. Security measures (TOMs)
Processor will implement TOMs appropriate to risk, including:
- access controls (least privilege), authentication controls
- encryption in transit and vendor-managed encryption at rest where available
- logging and monitoring for abuse and security
- separation of environments where feasible
- incident response procedures

More detail: Annex 2.

## 8. Personal Data Breach
Processor will notify Controller without undue delay after becoming aware of a Personal Data Breach affecting Controller Personal Data, and provide information reasonably required to support Controller’s legal obligations.

## 9. Audits
Controller may audit Processor’s compliance with this DPA:
- no more than once per year unless a material incident or reasonable suspicion
- with reasonable notice
- subject to confidentiality and security requirements
- Processor may satisfy audit requests with third-party reports and documentation where appropriate

## 10. Data return and deletion
At termination or upon Controller request, Processor will delete or return Controller Personal Data within a reasonable period, unless retention is required by law.

## 11. Liability
Liability under this DPA follows the limitation of liability in the main agreement, unless mandatory law provides otherwise.

## Annex 1 — Processing details

### A. Subject matter
Provision of the Platform to manage WhatsApp/voice conversations, lead qualification workflows, lead summaries, and related features.

### B. Duration
For the term of the Customer’s subscription/use of the Platform, plus any deletion/return period.

### C. Nature and purpose of Processing
Processing activities may include:
- receiving inbound messages (webhooks) and sending outbound messages
- storing conversation history and lead state
- running automated qualification workflows and generating summaries
- supporting manual messaging, tagging, and operational actions
- (if enabled) handling voice calls and call recordings

### D. Categories of Data Subjects
Controller’s leads/contacts and other individuals who communicate with Controller via WhatsApp/voice, including prospective buyers/tenants.

### E. Categories of Personal Data
May include:
- identifiers: phone number, chat IDs, call IDs, timestamps
- communications content: message text, conversation history
- lead attributes: name, household composition, income (numeric), pets, payment method, visit availability, notes
- call data: call metadata and recordings/recording URLs (if enabled)

### F. Special categories
Not intended; Controller should avoid using the Platform to process special categories unless strictly necessary with a lawful basis and safeguards.

### G. Processing operations (technical description)
Indicative flow (as implemented in codebase):
- inbound WhatsApp/voice events → buffer/store in database → queue tasks → generate AI response/summary → send message and update lead/conversation state.

## Annex 2 — Technical and organisational measures (TOMs)
Processor maintains TOMs aligned to the service, including:
- logical access control and role-based access where applicable
- secure secrets management for API keys
- transport security (TLS) between services and vendors
- audit logging and monitoring of key operations
- secure development practices and change management
- incident response and breach handling procedures

## Annex 3 — Sub-processors
See `legal/subprocessors.md`.

