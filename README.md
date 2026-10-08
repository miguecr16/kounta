# Kounta — Contabilidad Moderna Multi-Tenant

Plataforma de facturación y contabilidad moderna, ágil y multi-tenant orientada a empresas en Colombia (🇨🇴 DIAN / NIT / COP) y Estados Unidos (🇺🇸 IRS / EIN / USD).

Diseñada con una estética fintech sobria, minimalista y de alto contraste (estilo Stripe / Linear), evitando gradientes excesivos o interfaces genéricas.

---

## 🚀 Características Principales (Fase 1)

1. **Aislamiento Multi-Tenant con Row Level Security (RLS):**
   - Políticas activas en Supabase para aislamiento total por empresa.
   - Todo el acceso a datos (`companies`, `customers`, `invoices`, `invoice_items`) respeta la pertenencia (`company_members`).

2. **Control de Acceso Basado en Roles (RBAC):**
   - **ADMIN:** Control total de la empresa, configuración fiscal (NIT/EIN), moneda base, gestión e invitación de colaboradores.
   - **WORKER:** Rol operativo para emitir comprobantes y registrar clientes; sin acceso a configuración ni gestión de equipo.

3. **Multi-Jurisdicción y Monedas:**
   - **Colombia (CO):** Número de Identificación Tributaria (NIT con dígito de verificación) y moneda base en Pesos Colombianos (`COP`).
   - **Estados Unidos (US):** Employer Identification Number (EIN de 9 dígitos) y moneda base en Dólares (`USD`).

4. **Dashboard Financiero y Facturación:**
   - Métricas clave en tiempo real: **Total facturado**, **Cuentas por cobrar**, **Facturas pendientes** y **Total recaudado**.
   - Tabla contable con alineación decimal monoespaciada (`tabular-nums`).
   - Módulo para emitir facturas con cálculo automático de subtotal, IVA y total.
   - Directorio de clientes vinculados por tenant.
   - Selector dinámico de empresa en la barra lateral para usuarios con múltiples compañías.

---

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router con Turbopack)
- **Lenguaje:** TypeScript 5
- **Estilos:** Tailwind CSS v4 con variables semánticas fintech
- **Iconografía:** Lucide React
- **Base de Datos & Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`) con Row Level Security (RLS)

---

## 📦 Configuración del Entorno de Desarrollo

### 1. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto tomando como base `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xtnmbhzcyzhacoofecid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5RYD_XlWbPwkDCstUzskdQ_K5GytgSe
```

> **Nota:** El archivo `.env.local` está ignorado en `.gitignore` para no exponer credenciales sensibles.

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Ejecución en Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

### 4. Compilación de Producción

```bash
npm run build
npm run start
```

---

## 🏛️ Estructura del Proyecto

```
src/
├── app/
│   ├── auth/                 # Pantalla 1: Inicio de sesión y Registro
│   ├── onboarding/           # Pantalla 2: Creación de empresa inicial
│   ├── dashboard/            # Pantalla 3: Shell y Módulos
│   │   ├── page.tsx          # Resumen contable y métricas rápidas
│   │   ├── invoices/         # Módulo de Facturas y emisión
│   │   ├── customers/        # Directorio de clientes
│   │   └── settings/         # Configuración y equipo (Sólo ADMIN)
│   ├── globals.css           # Estilos fintech y tabular-nums
│   ├── layout.tsx            # Root layout con AuthProvider
│   └── page.tsx              # Redirección inteligente de rutas
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx       # Barra lateral con selector de empresa activa
│   │   └── header.tsx        # Encabezado con estado y botón de factura
│   └── modals/
│       ├── create-invoice-modal.tsx   # Modal de emisión de facturas
│       └── create-customer-modal.tsx  # Modal de registro de clientes
├── context/
│   └── auth-context.tsx      # Gestión de sesión, tenant y RBAC
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Cliente Supabase del navegador
│   │   ├── server.ts         # Cliente Supabase del servidor (cookies)
│   │   └── middleware.ts     # Refresco de sesión
│   └── utils.ts              # Formateo de moneda (COP/USD) y estados
├── middleware.ts             # Protección de rutas Next.js
└── types/
    └── database.ts           # Tipos TypeScript para el esquema de Supabase
```

---

## 🔒 Consideraciones de Supabase Auth

En proyectos de Supabase con confirmación de correo habilitada por defecto, el envío de correos directos puede verse limitado por la cuota de prueba SMTP. Para registro local sin confirmación obligatoria:
1. En el panel de Supabase: `Authentication` > `Providers` > `Email`.
2. Desmarcar la casilla **"Confirm email"** si deseas que los usuarios inicien sesión directamente tras registrarse.
