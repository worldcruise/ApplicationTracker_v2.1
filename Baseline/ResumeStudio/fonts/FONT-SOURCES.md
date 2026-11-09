# Font assets

Noto Sans and Noto Serif retain their original pinned sources and SIL OFL
license in manifest.json and OFL.txt.

The following actual Windows font faces were copied from this machine's
`C:/Windows/Fonts` for the user's requested local unpacked extension build:

| Family | Regular source | Bold source |
|---|---|---|
| Times New Roman | times.ttf | timesbd.ttf |
| Courier New | cour.ttf | courbd.ttf |
| Segoe UI | segoeui.ttf | segoeuib.ttf |
| Verdana | verdana.ttf | verdanab.ttf |

Their original embedded names, copyright notices and bytes are unchanged.
The registry and manifest pin both faces by SHA-256. Only upright Regular
and Bold are used; no synthetic weights, styles or substitute families are
registered. Helvetica Neue is unavailable and is not listed in the picker.

These eight Windows files are proprietary and are **not covered by OFL.txt**.
Their OS/2 flags permit editable document embedding and subsetting; the
renderer embeds subsets in PDFs. Those flags do not grant permission to
redistribute the full font files in a publicly shared extension. A public
release containing them still requires the appropriate font distribution
rights. No such rights are asserted by this local implementation.
