# Campos declarados/visibles en la Interface pero NO usados en `appointments.tsx`

Comparé el JSON exportado contra el código real de `appointments.tsx` — estos
campos están marcados como visibles en el bloque Custom code de esta página,
pero el código no los lee en ningún lado. Orden A-Z por field dentro de cada
tabla.

**⚠️ Campo primario — NUNCA ocultar mientras la tabla siga declarada con otros
campos activos.** Aunque el código no lo use por nombre, Airtable exige que el
campo primario de una tabla se quede accesible en cuanto el bloque tiene
acceso a cualquier otro campo de esa misma tabla — ocultarlo rompe `useRecords`
en tiempo real (confirmado en vivo, 2026-08-27: ocultar `title` en `feedback`
provocó `Cannot read properties of null (reading 'id')`). Sí es seguro
ocultarlo si vas a des-declarar la tabla COMPLETA (ahí no aplica la regla,
porque no queda ningún otro campo activo).

## appointment_types

| Field Name | |
|---|---|
| type_label | ⚠️ campo primario |

## customization_requests

| Field Name | |
|---|---|
| Date of Request | |
| customization_pricing | |

## DF Clients

| Field Name | |
|---|---|
| Favorite Styles in Appointment | |
| Samples Not Where Needed (NY) | |

## DF Styles

| Field Name | |
|---|---|
| Style Name | ⚠️ campo primario |

## feedback

| Field Name | |
|---|---|
| title | ⚠️ campo primario |

## interface_inventory

| Field Name | |
|---|---|
| feedback_interface | |
| feedback_page | |
| page | |
| page_type | |

## order_adjustments

| Field Name | |
|---|---|
| amount | |
| order_id | ⚠️ campo primario |

## order_items

| Field Name | |
|---|---|
| style_category | |

## order_sync_changelog

| Field Name | |
|---|---|
| changelog_id | ⚠️ campo primario |
| order | |

## Orders - Shopify

| Field Name | |
|---|---|
| Delivery Status | |

## rooms

| Field Name | |
|---|---|
| appointments | |
| is_active | |
| studio | |

## sample_log

| Field Name | |
|---|---|
| style_name_legacy | |

## staff

| Field Name | |
|---|---|
| alterations_lead_appointments | |
| full_name | ⚠️ campo primario |
| role | |

## studios

| Field Name | |
|---|---|
| appointment_types | |
| rooms | |
| studio_id | ⚠️ campo primario |

## Vendors

| Field Name | |
|---|---|
| Full Name | ⚠️ campo primario |

---

**Tablas donde TODOS los campos listados quedan cubiertos por "des-declarar la
tabla completa" en vez de ocultar campo por campo** (confirmado: ninguna se
referencia por tabla ID en el código tampoco): `DF Styles`, `sample_log`,
`Vendors`, `customization_requests`.
