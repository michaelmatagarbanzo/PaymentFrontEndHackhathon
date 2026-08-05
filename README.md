# 3DS Payment Tester — Vue 3 + TypeScript

Cliente de pruebas para las APIs de pago 3DS (BCO Checkout / Amex SafeKey).

## 🚀 Instalación

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## ⚙️ Configuración

### Endpoint de pagos: Sale API (appgateway-hackhathon-api)

El formulario de Cliente (`PaymentView.vue`) envia `POST /api/v1/sales` (contrato real
en https://appgateway-hackhathon-api.azurewebsites.net/v3/api-docs). Ese backend exige
un JWT de Microsoft Entra ID y **no tiene CORS configurado**, por lo que el navegador
no puede llamarlo directo. `src/utils/salesApi.ts` en cambio llama a `/api/v1/sales`
(mismo origen), y `vite.config.ts` (`devApiPlugin`) intercepta esa ruta en el dev
server: obtiene un token vía Client Credentials y reenvia la petición con el
`Authorization: Bearer` agregado — el Client Secret nunca llega al navegador.

> ⚠️ Este proxy solo corre con `npm run dev`. El build de producción (`dist/`) es
> estático — si se despliega tal cual (como hace el workflow de GitHub Actions
> actual), `/api/v1/sales` no tendrá backend que lo sirva. Para que la demo
> funcione desplegada hace falta CORS en el backend + un App Registration tipo
> SPA con PKCE, o un servidor (no estático) que haga este mismo proxy.

1. Cree un archivo `.env` en la raiz del proyecto usando `.env.example` como base.
2. Configure las credenciales del proxy (pídalas al equipo — están en la guía de
   integración interna, `Client ID`/`Client Secret` del App Registration `sale-api`):

```env
AZURE_SALES_TENANT_ID=754d6f21-67a5-4063-be7a-ac70991f2bd8
AZURE_SALES_CLIENT_ID=
AZURE_SALES_CLIENT_SECRET=
AZURE_SALES_API_BASE_URL=https://appgateway-hackhathon-api.azurewebsites.net
```

3. Reinicie `npm run dev`.

### Endpoint de pagos AppConnector (legado, backend eliminado)

El proyecto también tenía un flujo contra `POST /api/v1/payments` (contrato
AppConnector, auth con `X-API-Key`), servido por el Web App
`PaymentProcessorHachathon`. Ese Web App se eliminó por accidente en Azure y no
se restauró, así que ese flujo ya no tiene backend activo — se reemplazó por el
de Sale API arriba.

### Login con Microsoft Azure (MSAL)

El login de Azure existe para otros flujos internos del proyecto y se configura con:

```env
VITE_AZURE_CLIENT_ID=tu-client-id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/tu-tenant-id
VITE_AZURE_SCOPES=api://tu-api-app-id/access_as_user
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AZURE_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
```

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
│   ├── salesApi.ts             ← Builder + cliente HTTP de /api/v1/sales
│   ├── jwt.ts                  ← Generación de JWT con HMAC-SHA256 (Web Crypto API)
│   ├── currency.ts             ← doubleToIso, formatCurrency, etc.
│   ├── products.ts             ← Base de datos de productos (equivalente a ProductosDB.cs)
│   └── scriptLoader.ts         ← Carga dinámica de SDKs externos
├── router/
│   └── index.ts
├── views/
│   ├── CheckoutView.vue        ← Flujo BCO Checkout (modal externo)
│   ├── PaymentView.vue         ← Cliente Sale API (POST /api/v1/sales)
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

Nota: el flujo principal de `PaymentView.vue` actualmente usa el endpoint Sale API (JWT via proxy server-side, ver sección de configuración arriba); los flujos de JWT firmado en cliente se mantienen para Checkout/runner.

## 📦 Build para producción

```bash
npm run build
```

Los archivos se generan en `dist/`.
# PaymentFrontEndHackhathon
# PaymentFrontEndHackhathon
