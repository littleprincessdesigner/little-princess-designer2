Four settings files. Three of them (`settings.json`, `settings-contact.json`,
`settings-products.json`) feed the merge in `tools/content.js` — `readSettings`.
`settings-sale.json` is read on its own by `readSale`, never merged in, exactly
as on the real site: it carries a `seo` object and so does `settings.json`, and
the merge would report that as a clash.

`deliveryNote` is deliberately in two of the merged files: a setting declared on
two pages of the admin is the one way this split can go wrong, and the build has
to say so by name rather than quietly picking one. Nothing else here is a real
setting — the values only have to be told apart.
