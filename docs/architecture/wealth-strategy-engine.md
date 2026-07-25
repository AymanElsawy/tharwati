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