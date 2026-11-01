# Value map

| Level | Value | Where to obtain | Format | Store | Blocking point |
|---|---|---|---|---|---|
| L0 | collectionPrefix | Project name | `xxx_` | server config | None |
| L0 | homePage | Page map | `/pages/...` | mini config | None |
| L1 | appId | Console mini-app page or authorized URL | `tt` + 16–18 chars | mini/server config | Cloud calls |
| L1 | dev/prod envId | Cloud development environment list | `env-...` | mini config | Cloud calls |
| L1 | resourceEnv/serviceId | Environment detail and service list | platform IDs | mini config | Container calls |
| L1 | TAG_GROUP | Payment capability page | `__UN_SHIFT_...` | server config | Payment setup |
| L2 | TCB access keys | Cloud key management | long strings | ignored secrets file | Database setup |
| L2 | payment key/SALT | Merchant key management | PEM / fixed string | platform secrets collection | Signatures |
| L2 | AppSecret | Developer platform; verification may make this L3 | string | ignored secrets file | Token calls |
| L1 | business-license image | Authorized account center page | png/jpg | `~/subject-profile/01-主体资质/` | Merchant onboarding |
| L1 | entity text fields | Same account center page | text | `subjectProfile` | Merchant onboarding |
| L1 | merchant number | Payment account management | digits | config/secrets | Payment |
| L1 | settlement account | Payment onboarding detail drawer | digits | `subjectProfile` | Settlement |
| L3 | identity images | User supplies them; platform does not return them | jpg/png | `~/subject-profile/02-法人证件/` | Verification |
| L0 | products/prices | Product-spec discussion | config objects | server config | Payment tests |
| L3 | DINGTALK_TOKEN / DINGTALK_SECRET | 用户本人钉钉 App：建群 → 群设置 → 机器人 → 添加「自定义」→ 安全设置必须选「加签」→ 复制 webhook 中的 access_token 与 SEC 开头密钥 | token / `SEC...` | 抖音云控制台 dev/prod 容器「服务设置 → 环境变量」各配一份（**不走 platform_secrets 集合**，与 TCB 密钥同级按容器环境变量处理） | 支付通知（可选，不配则静默关闭） |

Never ask for a value that an authorized platform session can safely retrieve. Never download material outside `~/subject-profile/`.
