<!--
  Reading the source? Everything below is drawn by scripts/survey.mjs.
  A GitHub Action pulls my contribution calendar every morning, turns each day
  into a hill, contours the result with marching squares, and pushes the SVGs
  to the `output` branch. No third-party card services; the fonts ride inside
  the SVGs. Fork it, change the login, and survey your own year.
-->

<a href="https://github.com/noderaven?tab=overview">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/sheet-dark.svg">
    <img alt="noderaven: Security and IT engineer who ships. A topographic map of my last year of GitHub contributions, where busy days rise into hills." src="https://raw.githubusercontent.com/noderaven/noderaven/output/sheet-light.svg" width="100%">
  </picture>
</a>

<a href="https://github.com/noderaven/parallel-lanes"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-parallel-lanes-dark.svg"><img alt="parallel-lanes: Claude Code skill that runs an approved implementation plan as parallel lanes of reviewed tasks" src="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-parallel-lanes-light.svg" width="49%"></picture></a>
<a href="https://github.com/noderaven/solid-macro"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-solid-macro-dark.svg"><img alt="solid-macro: VBA macro chain demonstrating modern EDR-evasion techniques" src="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-solid-macro-light.svg" width="49%"></picture></a>
<a href="https://github.com/noderaven/casebound-converter"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-casebound-converter-dark.svg"><img alt="casebound-converter: convert PST, OST, MSG and EML email to court-ready, Bates-numbered PDFs" src="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-casebound-converter-light.svg" width="49%"></picture></a>
<a href="https://github.com/noderaven/payload-obfuscator"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-payload-obfuscator-dark.svg"><img alt="payload-obfuscator: a Python tool for studying Windows PE binary obfuscation" src="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-payload-obfuscator-light.svg" width="49%"></picture></a>
<a href="https://github.com/noderaven/strava-overlay"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-strava-overlay-dark.svg"><img alt="strava-overlay: topographic trail-running poster generator" src="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-strava-overlay-light.svg" width="49%"></picture></a>
<a href="https://github.com/noderaven/breach-web-scraper"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-breach-web-scraper-dark.svg"><img alt="breach-web-scraper: scrapes breach websites into a readable summary" src="https://raw.githubusercontent.com/noderaven/noderaven/output/wp-breach-web-scraper-light.svg" width="49%"></picture></a>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/noderaven/noderaven/output/legend-dark.svg">
  <img alt="Legend: language share across public repos, plus the tools I build with and the ground I cover: Microsoft 365, Exchange Online, identity, endpoint hardening, Windows and Linux." src="https://raw.githubusercontent.com/noderaven/noderaven/output/legend-light.svg" width="100%">
</picture>

<details>
<summary><b>Field kit</b>: PowerShell I reach for on Exchange Online and Windows endpoints</summary>
<br>

| Script | What it does |
| --- | --- |
| [Enable-AllMailboxAuditingForTenant](https://github.com/noderaven/Enable-AllMailboxAuditingForTenant) | Turns on mailbox auditing for every user, shared, room and equipment mailbox, with a standard set of owner, admin and delegate actions |
| [Enable-AllUserMailboxArchives](https://github.com/noderaven/Enable-AllUserMailboxArchives) | Enables the archive on every user mailbox that doesn't have one yet |
| [Set-MrmPolicyOnUserMailboxes](https://github.com/noderaven/Set-MrmPolicyOnUserMailboxes) | Applies a retention policy to all user mailboxes |
| [Uninstall-WebrootAndEnableDefender](https://github.com/noderaven/Uninstall-WebrootAndEnableDefender) | Removes Webroot SecureAnywhere cleanly and switches Microsoft Defender on |
| [Get-NetAdapterPowerConfig](https://github.com/noderaven/Get-NetAdapterPowerConfig) | Reports network adapter power-saving settings, built to run remotely and unattended |
| [Update-LSOAndTest](https://github.com/noderaven/Update-LSOAndTest) | Disables Large Send Offload, tests connectivity, and tries to recover if the network drops |

</details>

<details>
<summary><b>How this page is made</b></summary>
<br>

The map is my contribution calendar. Each day is a survey point, and each day's commits raise a hill of height log<sub>2</sub>(1 + commits). The hills are summed, contoured with marching squares and smoothed into Béziers. The five highest peaks are marked with that day's count, and the magenta flight line links them in order, ending today. The line under each project is its weekly commits over the past year.

[`scripts/survey.mjs`](scripts/survey.mjs) does all of it with no dependencies, and [`.github/workflows/survey.yml`](.github/workflows/survey.yml) runs it every morning.

</details>

<p align="right"><a href="https://www.linkedin.com/in/riley-mcgowen/">Find me on LinkedIn</a></p>
