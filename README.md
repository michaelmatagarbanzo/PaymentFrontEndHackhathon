# 3DS Payment Tester — Vue 3 + TypeScript

Cliente de pruebas para las APIs de pago 3DS (BCO Checkout / Amex SafeKey).

## 🚀 Instalación

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## ⚙️ Configuración

Edita **`src/config/merchants.config.json`** para agregar o modificar terminales:

```json
{
  "merchants": [
    {
      "merchantId": "52599001",
      "privateKey": "CnDftk4LswujEO4EWApcjmFrxXai6K62bBJv7ObmOG76SHo02jf",
      "publicKey": "jyY8pQu/OpBohKp9j1",
      "terminalId": "TEST1",
      "description": "Terminal de Prueba 1",
      "audience": "BCO"
    },
    {
      "merchantId": "10001235",
      "privateKey": "TU_PRIVATE_KEY",
      "publicKey": "TU_PUBLIC_KEY",
      "terminalId": "Kolau01",
      "description": "Terminal Safekey",
      "audience": "BCO"
    }
  ],
  "checkoutScripts": {
    "development": "http://localhost:8081/CheckOut/js/checkout.js",
    "staging": "https://csp.credomatic.com:50581/3DS/CheckOut/js/checkout.js",
    "production": "https://ecommerce.credomatic.com:447/3DS/CheckOut/js/checkout.js"
  },
  "safekeyScripts": {
    "development": "https://ecommerce.credomatic.com:447/3DS/API/Scripts/Safekey.js?v=2",
    "staging": "https://csp.credomatic.com:50581/3DS/API/Scripts/SafeKey.js",
    "production": "https://ecommerce.credomatic.com:447/3DS/API/Scripts/Safekey.js?v=2"
  },
  "environment": "development"
}
```

### Cambiar entorno

Modifica el campo `"environment"` a `"development"`, `"staging"`, o `"production"`.
Esto controla automáticamente qué script URL usa el SDK.

## 🏗️ Estructura del Proyecto

```
src/
├── config/
│   └── merchants.config.json   ← Configuración de terminales (equivalente a appsettings.json)
├── types/
│   └── index.ts                ← Tipos TypeScript
├── utils/
│   ├── jwt.ts                  ← Generación de JWT con HMAC-SHA256 (Web Crypto API)
│   ├── currency.ts             ← doubleToIso, formatCurrency, etc.
│   ├── products.ts             ← Base de datos de productos (equivalente a ProductosDB.cs)
│   └── scriptLoader.ts         ← Carga dinámica de SDKs externos
├── router/
│   └── index.ts
├── views/
│   ├── CheckoutView.vue        ← Flujo BCO Checkout (modal externo)
│   ├── PaymentView.vue         ← Flujo SafeKey (formulario de tarjeta)
│   └── ResultView.vue          ← Pantalla de resultado
└── components/
    ├── MerchantSelector.vue
    ├── ProductTable.vue
    └── TokenDisplay.vue
```

## 🔐 Generación de JWT

El JWT se genera **en el cliente** usando la Web Crypto API (HMAC-SHA256), 
replicando exactamente la lógica del `JwtClient.cs` original:

- Clave = bytes UTF-8 del `privateKey` del merchant
- Algoritmo: HS256
- Claims: `nbf`, `exp`, `iat`, `iss`, `aud`, `Request` (con datos de la transacción)

> ⚠️ **Solo para desarrollo/pruebas.** En producción, la firma del JWT debe hacerse server-side para no exponer el `privateKey`.

## 📦 Build para producción

```bash
npm run build
```

Los archivos se generan en `dist/`.
