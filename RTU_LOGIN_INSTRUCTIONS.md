# RTU Portal Integration - Manual Login Required

## Issue
The RTU portal login page requires:
- Client-side JavaScript captcha validation
- SHA1 password hashing with random salt
- Cannot be automated from server-side API

## Solution Options

### Option 1: Manual RTU Portal Access (Recommended - Simple)
Instead of automating the login, simply redirect users to RTU portal with pre-filled data:

1. User clicks "View Secret Info"
2. Opens RTU portal in new tab with student info pre-filled
3. User manually views the information there

### Option 2: Browser Extension
Create a browser extension that:
- Captures RTU session cookies after user logs in manually
- Sends those cookies to your API
- API uses those cookies to fetch student data

### Option 3: Puppeteer Automation
Install Puppeteer and use headless Chrome to:
- Automate browser login
- Requires OCR or manual captcha solving service
- Much more complex

## Current Status
- RTU login requires captcha + JavaScript hashing
- Server-side automation not feasible without headless browser
- Recommend using Option 1 (direct redirect to RTU portal)

Would you like me to implement Option 1 (simple redirect) or Option 3 (Puppeteer automation)?
