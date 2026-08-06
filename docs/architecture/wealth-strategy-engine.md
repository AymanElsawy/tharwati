# Wealth Strategy Engine

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** July 2026

---

# Purpose

The Wealth Strategy Engine is responsible for understanding the user's financial goals before any planning, dashboard calculations, or AI insights are generated.

Instead of asking every user the same questions, the engine builds a personalized journey where each answer determines the next step.

The result is a structured Wealth Strategy that becomes the foundation for the rest of the application.

---

# Objectives

The Wealth Strategy Engine should:

- Understand why the user is building wealth.
- Support multiple financial goals.
- Ask only relevant questions.
- Adapt the onboarding flow dynamically.
- Produce one unified Wealth Strategy.
- Supply structured data to other modules.

---

# Design Principles

## 1. Goal First

Every question must support a financial goal.

The application should never ask unnecessary questions.

---

## 2. Dynamic Journey

There is no fixed onboarding wizard.

Every answer determines the next question.

---

## 3. Multiple Goals

A user may have several goals at the same time.

Example:

- Retirement
- House
- Car
- Emergency Fund

The engine must support all of them simultaneously.

---

## 4. One Source of Truth

Shared information should only be collected once.

Examples:

- Base Currency
- Country
- Monthly Income

---

## 5. Goal-specific Questions

Every goal has its own questions.

Example:

Car Goal:

- Price
- Purchase Date
- Cash or Financing

Retirement Goal:

- Retirement Age
- Monthly Expenses
- Retirement Country

The engine should never show retirement questions while configuring a travel goal.

---

## 6. Extensible

Adding a new Goal Template should not require rebuilding the engine.

New goals should be plug-in based.

---

# Out of Scope (Version 1)

The Wealth Strategy Engine does NOT provide:

- Investment recommendations
- AI coaching
- Retirement simulations
- Monte Carlo analysis
- Automatic portfolio allocation

Those modules will consume the strategy later.

---

# Status

Draft
---

# Goal Types

A Goal Type represents a predefined financial objective that a user wants to achieve.

Each Goal Type defines:

- Required fields
- Optional fields
- Validation rules
- Dynamic questions
- Future calculations

Version 1 supports the following goal types.

| Goal Type | Priority | Complexity | Status |
|-----------|----------|------------|--------|
| Emergency Fund | High | Low | Planned |
| Retirement | High | High | Planned |
| Buy a House | High | Medium | Planned |
| Buy a Car | Medium | Low | Planned |
| Education | Medium | Medium | Planned |
| Travel | Low | Low | Planned |
| Start a Business | Medium | Medium | Planned |
| Custom Goal | Medium | Low | Planned |

---

# Goal Type Details

## Emergency Fund

Purpose

Build cash reserves for unexpected events.

Minimum Required Fields

- Target Amount
- Currency

Optional

- Target Date
- Priority
- Notes

---

## Retirement

Purpose

Plan long-term financial independence.

Minimum Required Fields

- Retirement Age
- Retirement Country
- Expected Monthly Expenses

Optional

- Existing Retirement Savings
- Inflation Assumption
- Notes

---

## Buy a House

Purpose

Save toward purchasing residential property.

Minimum Required Fields

- Target Amount
- Currency
- Target Date

Optional

- Down Payment
- Financing Method
- Notes

---

## Buy a Car

Purpose

Save toward purchasing a vehicle.

Minimum Required Fields

- Target Amount
- Currency
- Target Date

Optional

- Cash or Financing
- Vehicle Type
- Notes

---

## Education

Purpose

Save for future education expenses.

Minimum Required Fields

- Target Amount
- Currency
- Target Date

Optional

- Student Name
- Notes

---

## Travel

Purpose

Save for a planned trip.

Minimum Required Fields

- Destination
- Budget
- Currency
- Target Date

Optional

- Flexible Dates
- Notes

---

## Start a Business

Purpose

Accumulate capital to launch a business.

Minimum Required Fields

- Target Capital
- Currency
- Target Date

Optional

- Business Type
- Existing Capital
- Notes

---

## Custom Goal

Purpose

Allow users to create financial goals that are not covered by predefined templates.

Minimum Required Fields

- Goal Name
- Target Amount
- Currency

Optional

- Target Date
- Description
- Notes
---

# Goal Data Model

Every user goal is stored as a Goal Instance.

A Goal Instance contains shared fields used by all goal types, plus goal-specific answers.

## Shared Goal Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Unique goal identifier |
| user_id | UUID | Yes | Goal owner |
| goal_type | String | Yes | Goal template identifier |
| name | String | Yes | User-facing goal name |
| status | String | Yes | draft, active, paused, completed, abandoned |
| priority | String | Yes | primary, high, medium, low |
| target_amount | Decimal | Conditional | Required when the goal has a defined financial target |
| currency_code | String | Conditional | Currency of the target amount |
| target_date | Date | Conditional | Expected completion date |
| current_allocated_amount | Decimal | No | Amount explicitly allocated to this goal |
| notes | Text | No | User notes |
| answers | JSON | Yes | Goal-specific answers |
| created_at | Timestamp | Yes | Creation date |
| updated_at | Timestamp | Yes | Last update date |

---

# Goal Statuses

The supported statuses are:

```text
draft
active
paused
completed
abandoned
---

# Dynamic Question Engine

## Purpose

The onboarding experience must adapt to the user's selected goals.

The application should never ask every user the same questions.

Instead, questions are generated dynamically based on:

- Selected goal types
- Previous answers
- Required information
- Optional information

---

## Flow

The onboarding follows this sequence:

1. User selects one or more goals.
2. The engine loads the required questions for each goal.
3. Shared questions are asked only once.
4. Goal-specific questions are asked only when needed.
5. The onboarding ends when all required information has been collected.

---

## Shared Questions

Shared questions are common across multiple goals and should never be repeated.

Examples:

- Preferred language
- Base currency
- Country
- Monthly income (when required)
- Existing savings (when required)

---

## Goal-Specific Questions

Each goal defines its own questions.

Example:

### Retirement

- At what age do you want to retire?
- Where do you plan to retire?
- What monthly income do you expect after retirement?

---

### House

- What is your target budget?
- Do you plan to pay cash or finance?
- When do you want to buy the property?

---

### Travel

- Destination
- Estimated budget
- Target travel date

---

## Rules

1. Never ask the same question twice.
2. Ask only questions required for the selected goals.
3. Skip irrelevant questions.
4. Preserve answers when the user leaves and returns.
5. Allow users to skip optional questions.
6. The engine must be extensible so future goal types can define their own questions without changing the core logic.
### Analysis, Not Advice

Tharwati provides financial analysis, progress tracking, contextual insights, and wealth intelligence based on user data.

The application never recommends buying, selling, or selecting specific financial products.

Final financial decisions always remain with the user.
