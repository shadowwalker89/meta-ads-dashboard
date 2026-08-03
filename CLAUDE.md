# [CLAUDE.md](http://CLAUDE.md)

## Project

Meta Ads Reporting Dashboard

هدف پروژه:

ساخت یک سامانه گزارش‌گیری کمپین‌های Meta Ads با قابلیت توسعه از Playwright به Meta Marketing API بدون تغییر در لایه نمایش.

---

## Tech Stack

- Next.js (App Router)

- TypeScript

- TailwindCSS

- Supabase

- PostgreSQL

- Playwright

- PWA

---

## Architecture

این پروژه بر اساس Clean Architecture توسعه داده می‌شود.

### قوانین

- هیچ Business Logic داخل UI نوشته نشود.

- هیچ Query دیتابیس داخل React Component نباشد.

- Collector مستقل از Dashboard باشد.

- همه توابع TypeScript باشند.

- استفاده از `any` ممنوع است مگر با توضیح.

- تمام توابع JSDoc داشته باشند.

- فایل‌ها کوچک و تک‌مسئولیتی باشند.

---

## Folder Rules

apps/dashboard

فقط صفحات و UI

apps/collector

فقط استخراج داده

packages/database

تمام مدل‌های دیتابیس

packages/shared

Utility و Typeها

packages/ui

کامپوننت‌های مشترک

---

## Coding Style

- Functional Components

- Async/Await

- ESLint

- Prettier

---

## Security

هیچ Secret داخل Repository قرار نگیرد.

همه Secretها داخل `.env.local`

---

## Git

Branch اصلی:

main

Development:

develop

Feature:

feature/*

---

## Future

Collector باید قابل جایگزینی با Meta API باشد.

هیچ بخشی از Dashboard نباید بداند داده از Playwright آمده یا API.