# Platform task register

Start long-running reviews first, then finish immediate tasks. Before submitting a form, show the user a summary. Scans, verification codes, face checks, signatures, and payments remain user actions.

## Service category

- Entry: capability or service-category management
- Duration: immediate to days
- Dependency: target category must support the intended payment capability
- Output: category status in the waiting list; doctor checks the console state

## ICP filing

- Entry: filing portal outside the developer console
- Duration: about 20 working days
- Dependency: entity and website information
- Output: filing number; blocks version submission, not development

## Merchant onboarding

- Entry: payment account management
- Duration: 1–3 days
- Dependency: entity documents, category, settlement account
- Output: merchant number and onboarding status

## Payment keys and balance alert

- Entry: merchant key management and account alerts
- Duration: immediate after onboarding
- Dependency: approved merchant account
- Output: keys in the platform-secrets document and a low-balance alert (suggested threshold: 5 yuan)

## Customer service

- Entry: byteHi or IM customer-service configuration
- Duration: immediate to hours
- Dependency: a staffed support account
- Output: an online support route; required for transaction review

## Business account and promotion

- Entry: enterprise business-account and capability authorization pages
- Duration: about one day plus operator activation
- Dependency: same-subject enterprise account; operator activates in the Douyin app within the platform window
- Output: authorized mounting capabilities and promotion-plan status

## Waiting-list rule

The launch phase must output each pending item, estimated duration, query URL, dependency, and the value to collect when approved. Keep it next to the project, never in credentials.
