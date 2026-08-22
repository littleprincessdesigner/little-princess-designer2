Three settings files, for the merge in `tools/content.js`.

`deliveryNote` is deliberately in two of them: a setting declared on two pages
of the admin is the one way this split can go wrong, and the build has to say
so by name rather than quietly picking one. Nothing else here is a real
setting — the values only have to be told apart.
