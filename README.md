# Verity — AI-Powered User Research for Startups

Verity is an AI-powered research platform on **NEAR Protocol** that converts survey respondents into engaged users through intelligent interviews and real-time insights.

**Helping startups find Product Market Fit with fewer wrong turns and wasted time.**

## Quickstart

### Prerequisites

- Node.js
- pnpm

### Install Dependencies

```bash
pnpm install
```

### Run Locally

```bash
pnpm dev
```

### Run Tests

```bash
pnpm test
```

## 🚀 What We’re Building

Verity is an **AI-powered user research platform** that:

- Runs adaptive qualitative interviews using AI.
- Incentivizes respondents with USDC on NEAR to get honest, bias-free feedback.
- Delivers real-time, actionable insights to founders.

## 🛠 How It Works

                ┌──────────────────────────┐
                │        Founder           │
                └─────────────┬────────────┘
                              │
          Create Project & Target Audience
                              │
                              ▼
                ┌──────────────────────────┐
                │    Founder Dashboard     │
                │ - Project setup           │
                │ - Incentive budget        │
                │ - Dashboard link          │
                └─────────────┬────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │   Share Interview Link   │
                │ (Discord, Twitter, etc.) │
                └─────────────┬────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │       Respondent         │
                └─────────────┬────────────┘
                              │
         Click Link → Consent → Connect Wallet (optional)
                              │
                              ▼
                ┌──────────────────────────┐
                │ AI Interview Engine      │
                │ - Adaptive Q&A           │
                │ - Follow-ups via LLM     │
                └─────────────┬────────────┘
                              │
         Store transcript in DB → Hash & log on NEAR
                              │
                              ▼
                ┌──────────────────────────┐
                │ Incentive Payout in USDC │
                │ - MVP: direct transfer   │
                │ - V1: Shade Agent escrow │
                └─────────────┬────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │ Founder Dashboard Update │
                │ - Cluster insights       │
                │ - Export results         │
                └──────────────────────────┘

**MVP (V0)**

- **Frontend**: Next.js (TypeScript), shadcn/ui
- **Backend**: Node.js/TypeScript, Supabase (Postgres), Redis
- **AI**: OpenAI for adaptive interviews + clustering
- **Blockchain**:
  - Store interview hashes on NEAR for integrity
  - Payouts in native USDC on NEAR

**V1 with Shade Agents**

- Attested payout verification using NEAR Shade Agents + Phala Cloud
- Smart contracts for escrow and agent verification

## 📦 MVP Features

- **Respondent Flow**: Link → AI interview → payout
- **Founder Dashboard**: Create projects, view clusters, download results
- **On-chain Proof**: Hash of each interview stored on NEAR
- **Fast Incentives**: USDC payouts directly to NEAR wallets

## 🗺 Roadmap

**Phase 1: MVP**

- Off-chain interview + NEAR hash logging
- USDC payouts via service account
- Dashboard with clustering + exports

**Phase 2: Shade Agent Integration**

- TEE logic for attested payouts
- Escrow smart contract integration

---

_Part of the NEAR Protocol Rewards Program_


