# iSOptLab · Public Model Gallery

A browser-only demonstration of frozen surrogate models: case descriptions,
validation comparisons, parameter prediction and downloadable results.

## Cases

- **Official steady-state CSTR:** initial 96-observation protocol (degree-5
  polynomial, GPR and ANN) and refined 113-observation protocol (degree-5
  polynomial). Three responses: ethylene and butadiene mass fractions and
  reactor temperature. The declared inputs are 290–310 K and 80–120 kg/s.
- **Peaks benchmark:** degree-12 polynomial, GPR and ANN, trained under the
  same 600/200/200 partition. Independent assessment used 4,096 new points.

Every prediction uses the exported fitted preprocessing and parameters.
There is no training service, login, analytics or remote optimization call.
The page produces **point predictions**, not new gPROMS observations or
prediction intervals. Session prediction tables stay in memory until the
visitor downloads them or closes the page. Only the interface language is
stored in local storage.

## Run locally

Serve this directory with any static HTTP server, for example:

```bash
python -m http.server 8765
```

Open `http://127.0.0.1:8765/`. The relative asset paths and hash navigation work
on both a root domain and a GitHub Pages project path.

## Publish with GitHub Pages

Publish this directory as the root of a dedicated repository. In Settings →
Pages, select **Deploy from a branch**, **main**, **/(root)**. The `.nojekyll`
file keeps the distribution buildless. No secrets or environment variables
are required.

## Evidence and numerical verification

- `data/catalog.json`: case descriptions and correctly separated validation
  protocols, independent metrics and saved simulator checks.
- `data/models.json`: the allowlisted point-prediction parameters. Source
  SHA-256 fingerprints identify the original frozen model files.
- `data/reference-predictions.json`: 1,043 reference points and corresponding
  Python predictions, including domain corners and interior points.
- `data/validation.json`: measured JavaScript/Python agreement and browser
  acceptance checks from this release.

The public files exclude account records, database snapshots, private dataset
uploads, executable model pickles, simulator licenses and gPROMS project
files. The CSTR case covers an installed steady-state example within a
declared domain; the displayed constraints are demonstration screening values,
not plant safety limits. Peaks is an analytic benchmark, not a gPROMS model.
The full iSOptLab training platform and gPROMS automatic execution remain
separate deployments.
