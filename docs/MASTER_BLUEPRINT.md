# Tharwati Master Blueprint

Version: 0.1
Status: Draft

---

# 1. Product Vision

## What is Tharwati?

Tharwati is a modular personal wealth platform that helps people understand, manage, and grow their complete financial life from a single place.

Rather than focusing on only budgeting or investing, Tharwati provides a complete view of a user's wealth by combining assets, liabilities, goals, and financial insights into one unified workspace.

---

## Mission

Help every user make better financial decisions through clarity, organization, and intelligent guidance.

---

## Vision

To become the operating system for personal wealth management.

---

## Core Promise

Tharwati helps users answer six essential financial questions:

1. What do I own?
2. What do I owe?
3. What is my current net worth?
4. How is my wealth changing over time?
5. Am I on track to achieve my goals?
6. What should I do next?

---

## What Tharwati is NOT

Tharwati is not just:

- A budgeting app
- A portfolio tracker
- A net worth calculator
- A retirement calculator

It combines all of these into a single modular wealth platform.

---

## Product Philosophy

Every feature inside Tharwati must satisfy at least one of these objectives:

- Increase financial clarity.
- Save users time.
- Help users make better financial decisions.
- Encourage long-term wealth growth.
- Reduce financial complexity.

If a feature does not achieve at least one of these objectives, it should not be included.
---

# 2. Product Principles

These principles guide every product decision inside Tharwati.

---

## 2.1 Simplicity First

The first experience should feel simple and approachable.

Advanced functionality should appear only when users need it.

---

## 2.2 Modular by Design

Users only see modules that are relevant to them.

Modules can be enabled or disabled at any time.

Examples:

- Investments
- Business
- Gold
- Real Estate
- Vehicles

---

## 2.3 Everything Should Be Customizable

If users cannot find what they need, they should be able to create it.

Examples:

- Custom Goal
- Custom Asset
- Custom Liability
- Custom Category

---

## 2.4 AI Assists, Never Decides

AI provides:

- Insights
- Suggestions
- Predictions
- Explanations

AI never makes financial decisions on behalf of the user.

---

## 2.5 Empty States Must Be Helpful

Empty screens should always encourage the next action.

Never display empty tables or meaningless zeros.

Instead:

✓ Add your first investment

✓ Create your first goal

✓ Add your first bank account

---

## 2.6 One Source of Truth

Every piece of information should exist only once.

The dashboard, reports, and analytics must always use the same underlying data.

---

## 2.7 Progressive Disclosure

Only show information when it becomes useful.

Beginners should never feel overwhelmed.

Power users should never feel limited.

---

## 2.8 User Ownership

Users always own their data.

Users can:

- Export data
- Import data
- Delete data
- Edit everything they create

---

## 2.9 Long-Term Thinking

Every feature should help users improve their financial future.

Short-term distractions should be avoided.

---

## 2.10 Consistency

Every screen should follow the same design language.

Buttons

Cards

Forms

Navigation

Interactions

Animations

should feel consistent throughout the application.
---

---

# 3. User Journey

The user journey defines the complete experience from the first app launch to becoming an active long-term user.

---

## Stage 1 — First Launch

### Goal

Create trust and excitement.

### Screens

1. Splash Screen
2. Welcome Screen

### User Action

Tap **Get Started**

---

## Stage 2 — Module Selection

### Goal

Understand what the user wants to manage.

### Screen

What would you like to track?

Users can select one or more modules.

Examples:

- Cash & Bank Accounts
- Investments
- Gold
- Real Estate
- Business
- Vehicles
- Liabilities
- Financial Goals

These selections personalize the rest of the onboarding experience.

---

## Stage 3 — Personalization

### Goal

Ask only relevant questions.

The onboarding adapts based on the selected modules.

Examples

If Investments is selected:

- Investment experience
- Investment types

If Business is selected:

- Business ownership

If Goals is selected:

- Financial priorities

The user should never answer unnecessary questions.

---

## Stage 4 — Financial Setup

### Goal

Help users build their financial profile before entering the application.

Instead of showing an empty dashboard, users complete the sections that apply to them.

Example checklist:

□ Add your first bank account

□ Add your first investment

□ Add your first property

□ Add your first business

□ Add your first financial goal

Each step can be completed or skipped.

The application shows profile completion progress throughout this stage.

---

## Stage 5 — Workspace Generation

### Goal

Generate a personalized financial workspace.

Loading checklist:

✓ Creating your dashboard

✓ Preparing your wealth summary

✓ Enabling selected modules

✓ Generating insights

✓ Finalizing your workspace

---

## Stage 6 — First Dashboard

### Goal

Present a dashboard containing meaningful information from day one.

The dashboard should never appear empty.

Users should immediately see:

- Net Worth
- Goal Progress
- Assets
- Recent Activity
- Wealth Insights

If any section has no data, it should encourage the next action rather than display empty tables.

---

## Stage 7 — Daily Usage

Typical user actions include:

- Updating assets
- Tracking net worth
- Monitoring investments
- Following goal progress
- Reading AI insights
- Managing liabilities

---

## Stage 8 — Long-Term Growth

As users continue using Tharwati they should naturally:

- Add new asset types
- Create additional goals
- Enable new modules
- Receive deeper insights
- Improve long-term financial decisions

---

# 4. Information Architecture

The information architecture defines how Tharwati is organized and how users move between its main areas.

---

## 4.1 Primary Navigation

The main navigation should remain simple and scalable.

Primary sections:

1. Dashboard
2. Assets
3. Liabilities
4. Goals
5. Insights
6. Settings

---

## 4.2 Assets

All owned items are grouped under the Assets domain.

Asset categories may include:

- Cash & Bank Accounts
- Investments
- Gold & Precious Metals
- Real Estate
- Business
- Vehicles
- Custom Assets

Users should not see every asset category as a separate primary navigation item.

Instead, they enter the Assets section and view only the categories they have enabled.

---

## 4.3 Liabilities

All financial obligations are grouped under Liabilities.

Liability categories may include:

- Personal Loans
- Mortgages
- Credit Cards
- Business Loans
- Custom Liabilities

---

## 4.4 Goals

The Goals section contains all financial objectives.

Goal types may include:

- Retirement
- Emergency Fund
- Home Purchase
- Education
- Travel
- Wedding
- Business Goal
- Custom Goal

Users must be able to create goals that are not included in the predefined templates.

---

## 4.5 Insights

The Insights section helps users understand their financial position.

It may include:

- Net Worth Analysis
- Asset Allocation
- Wealth Growth
- Liability Analysis
- Goal Progress
- Portfolio Insights
- AI-Generated Insights

---

## 4.6 Settings

Settings should include:

- Profile
- Currency
- Enabled Modules
- Data Import and Export
- Notifications
- Privacy
- Security
- Appearance
- Account Management

---

## 4.7 Navigation Principle

The primary navigation should represent major financial domains, not individual asset types.

This keeps the application simple for beginners and scalable for advanced users.

Asset categories should appear inside the Assets section based on the modules enabled by the user.
---

# 5. Financial Profile Architecture

The Financial Profile is the digital representation of the user's financial life.

Every feature inside Tharwati is built around the Financial Profile.

Rather than treating assets, liabilities, goals, and investments as separate systems, Tharwati organizes them into one unified financial profile.

This architecture allows every module, insight, AI recommendation, and report to understand the complete financial picture.

---

## Financial Profile Structure

Financial Profile

├── Personal Information

├── Assets

│   ├── Cash & Bank Accounts
│   ├── Investments
│   ├── Gold & Precious Metals
│   ├── Real Estate
│   ├── Business
│   ├── Vehicles
│   ├── Crypto
│   └── Custom Assets

├── Liabilities

│   ├── Loans
│   ├── Credit Cards
│   ├── Mortgage
│   ├── Taxes
│   └── Other Debts

├── Financial Goals

├── Preferences

├── Enabled Modules

└── Financial Health

---

## Design Principles

The Financial Profile should always represent the user's complete financial situation.

Every new module added to Tharwati must integrate into the Financial Profile instead of creating isolated data.

The profile grows over time as users add more information.

No module should require data that is unrelated to the user's selected preferences.

---

## Benefits

A unified Financial Profile enables:

- Personalized dashboards
- AI-powered financial analysis
- Financial Health Score
- Wealth reports
- Goal tracking
- Cross-module insights
- Future scalability
---

# 6. Onboarding Philosophy

Tharwati is designed to minimize friction during onboarding.

The objective is not to collect every piece of financial information.

The objective is to help users reach value as quickly as possible.

---

## Core Principles

### Ask only what is necessary.

Every onboarding question must have a direct purpose.

If a question does not improve the initial experience, it should not be asked.

---

### Use simple language.

Financial terminology should be avoided whenever possible.

Questions should feel natural and understandable to users with any financial background.

Example:

Instead of:

"What is your investment strategy?"

Use:

"How do you feel about investment risk?"

---

### Learn over time.

The application should gradually understand the user through normal usage.

When users add assets, create goals, or record transactions, Tharwati becomes smarter without requiring lengthy questionnaires.

---

### Personalization should evolve.

The first onboarding creates an initial profile.

The profile becomes more accurate as users continue using the application.

---

### Never overwhelm the user.

The onboarding should feel lightweight.

Advanced preferences should always remain available inside Settings and can be changed at any time.
---

# 7. Domain Architecture

Tharwati is organized into independent financial domains.

Each domain is responsible for a specific part of the user's financial life.

Domains are designed to be modular, allowing future expansion without affecting the overall architecture.

---

## Core Domains

### Dashboard

Provides an overview of the user's financial profile.

Includes:

- Net Worth
- Goal Progress
- Financial Health
- Wealth Trend
- Recent Activity
- AI Insights

---

### Assets

Represents everything the user owns.

Modules include:

- Cash & Bank Accounts
- Investments
- Gold & Precious Metals
- Real Estate
- Business
- Vehicles
- Crypto
- Custom Assets

---

### Liabilities

Represents everything the user owes.

Examples:

- Personal Loans
- Credit Cards
- Mortgage
- Business Loans
- Taxes
- Other Debts

---

### Goals

Tracks financial objectives.

Examples:

- Retirement
- Emergency Fund
- Home Purchase
- Vehicle
- Education
- Travel
- Business Expansion
- Custom Goals

---

### Insights

Transforms financial data into useful information.

Examples:

- Net Worth History
- Asset Allocation
- Monthly Growth
- Spending Analysis
- Goal Progress
- Financial Health
- AI Recommendations

---

### Settings

Stores user preferences.

Examples:

- Currency
- Language
- Notifications
- Connected Accounts
- Appearance
- Security