npm i 
update env file  
npm run dev

Accounts

Current, savings, credit card, cash and investment accounts, with negative balances allowed for cards.
Default account, edit, archive and restore, and delete if empty.
Net worth across all accounts.
Balance chart for the last 60 days.
Ledger with a running balance after every entry.
“Verify balance” check that recomputes the balance from the ledger and can repair drift.

Transactions

Add income or expense, edit, delete, and bulk delete.
Search by description or merchant, with filters for type, category, account and date range, plus pagination.
21 categories, with automatic categorisation that learns your merchants.
Transfers between accounts, which don’t count as income or spending.
CSV import with column detection, day/month date order, credit-card sign flip, preview, and duplicate protection so re-importing a file does nothing.
CSV export of your transactions (safe against spreadsheet formula injection).

Recurring

Daily, weekly, monthly and yearly rules with an optional end date.
Past start dates are filled in automatically, and missed runs are caught up without double-posting.
Pause, resume and delete.
“Coming up” list for the next 30 days.
Detects repeating charges in your history (subscriptions) and offers to track them.

Budgets and goals

Monthly overall and per-category budgets with progress bars.
Email alerts at 80% and 100%, once each per month.
Budget suggestions calculated from your last three months.
Savings goals with an optional deadline, deposits and withdrawals, the monthly amount needed, and a “reached” state.

Dashboard and reports

Net worth, income, spending and left-over, compared with last month.
Month-end spending projection.
6-month and 12-month cash flow charts, category donut and table, top merchants, and month-by-month navigation.
Recent activity.
Alerts for category spending spikes, unusually large charges, and possible double charges.

AI (OpenRouter)

Receipt scanning: photo in, reviewable draft out.
“Describe it” entry, e.g. “lunch 450 yesterday, cab 200 from cash”.
Smart categorisation, plus a “Tidy categories” button for transactions sitting in Other.
Assistant for questions about your money. The AI plans the lookup and your database supplies the numbers.
AI monthly review, with a rule-based version when AI is off or unavailable.
Budget suggestions with AI-written explanations.
Per-user and global daily request caps, with an AI on/off switch in Settings.

Account and security

Sign up and sign in, with rate limiting.
Session list with per-device revoke, and sign out everywhere else.
Change password, which signs out your other devices.
Full JSON data export and account deletion.
Audit trail for sign-ins, imports, exports and deletions.
