# Updating the Credit Counterfeit Index

`public/data/cci.json` is the site's most valuable asset and its most
dangerous. A published index with a stated methodology and a dated forward
reading can be checked, which is exactly what makes it worth having and what
makes a careless update costly.

## What it measures

```
CCI = Monetary Bind − Real Bind
```

**Monetary Bind** is the mean z-score of four inputs: ICE BofA high yield OAS,
the SLOOS net share tightening C&I standards, the real fed funds rate, and
inverted real M2 growth. It rises when money is the scarce thing.

**Real Bind** is a published judgment series on genuine physical scarcity,
currently driven by Strait of Hormuz transit conditions, Brent, and the EIA
Short-Term Energy Outlook.

Threshold is **+1.0**. Above it, credit is counterfeiting a shortage that is
not physically real.

## Recover the weights before rescoring

Do not invent a scoring rule. The weights are recoverable from the published
series by least squares across all quarters, and reproduce it to a mean
absolute error of about 0.002:

```python
# MB = w1*hy_oas + w2*sloos + w3*real_ffr + w4*real_m2 + c
# fit against the existing quarters, then apply to the new one
```

Doing this means a new quarter is scored the same way every prior quarter was,
rather than by your judgment about what the inputs ought to mean.

## Getting the inputs

FRED is unreachable here. Go to the issuers:

| Input | Where |
|---|---|
| HY OAS | ICE BofA via any market data source |
| SLOOS | federalreserve.gov, quarterly (Jan / Apr / Jul / Oct) |
| Real fed funds | H.15 effective rate minus BEA core PCE |
| Real M2 growth | H.6 M2 year over year minus core PCE |
| Real Bind | EIA STEO, Brent, current transit conditions |

Check the **date** on everything. The near-miss worth remembering: a search
returned EIA releases describing the Strait reopening, which were three months
old. The reopening had since reversed, and the Real Bind was about to be
revised down when it should have gone up. Search for the current state, then
search again for whether it still holds.

## The revision note is part of the product

`meta.revision_note` is not a changelog. It is where the index admits what it
got wrong, and that admission is why the readings are credible.

A good note states what changed, what evidence forced it, what the previous
entry assumed, and what the new reading is. The September 2026 note names the
August error directly: it treated a partial reopening as a trend.

Be precise about direction. "Retreating from the threshold" and "rising more
slowly than we said" are different claims, and the quarter-over-quarter move
can rise while the revision itself is downward.

If the update exposes a structural limitation, add it to
`meta.known_limitation` rather than burying it.

## Sweep for stale quotes afterward

Changing the data makes every page quoting the old reading wrong.

```bash
python3 .claude/skills/dispatch/scripts/check.py --all
```

The convention:

- **Dated dispatches keep their original figures.** They carry an "as of" line
  and were correct when published. Rewriting them would falsify the record.
- **The gauge dispatch is the live page.** Its "Where it points today" section
  and its `post-meta` date must both be current.
- **The header badge and the widget read the JSON directly**, so they update
  on their own.

## Forward readings

Keep at most one projected quarter unless the path is genuinely defensible.
Mark it `"projected": true`, and say in the note what it assumes. When
uncertainty is wide on both sides, say that too, and call it a scenario rather
than a forecast.
