# Appetee

Appetee is a web application that tailors recipes based on:
- Diet preferences
- Personal taste
- Student-athlete budget constraints

## Current State

The platform currently includes:
- Frontend and backend architecture in place
- SQL database architecture in place
- Authentication using cookies and sessions
- Error and loading handling integrated into the architecture

## In Development

### Admin Recipe Creation
- Admins can create recipes
- Ingredients will be linked to Walmart items
- Item prices will be fetched and stored in the database
- Walmart stores will be clustered to calculate average cluster pricing

### Deployment
- Planned deployment on Azure, including backend services

## Target Timeline

- Expected delivery: April

## Local Development (Frontend)

Use HTTPS locally so the frontend can communicate with the backend (HTTPS-only).

1. Install `mkcert` (one-time on your machine), then install the local CA:

```bash
mkcert -install
```

2. From the project root, generate local HTTPS certificates:

```bash
mkcert localhost 127.0.0.1 ::1
```

This creates:
- `./localhost+2.pem`
- `./localhost+2-key.pem`

3. Start the frontend with SSL enabled:

```bash
ng serve --ssl true --ssl-cert "./localhost+2.pem" --ssl-key "./localhost+2-key.pem"
```

Then open:

```text
https://localhost:4200/
```

## Build

```bash
ng build
```

## Test

```bash
ng test
```
