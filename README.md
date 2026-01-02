# Text Justification API

This project provides a REST API for text justification. It takes a plain text as input and returns the text justified to a line length of 80 characters.

## Features

- Justifies text to a fixed line length (80 characters).
- Token-based authentication.
- Rate limiting to 80,000 words per day per user.

## API Documentation

### Authentication

To use the `/api/justify` endpoint, you need an authentication token. You can obtain a token by sending a `POST` request to the `/api/token` endpoint with your email address.

**Request:**
```bash
curl -X POST -H "Content-Type: application/json" -d '''{"email": "foo@bar.com"}''' http://localhost:3000/api/token
```

**Response:**
```json
{
  "token": "your_jwt_token"
}
```

### Justify Text

This endpoint justifies the provided text.

- **Endpoint:** `/api/justify`
- **Method:** `POST`
- **Headers:**
  - `Authorization: Bearer <your_jwt_token>`
  - `Content-Type: text/plain`
- **Body:** The raw text to be justified.

**Example Request:**
```bash
curl -X POST -H "Authorization: Bearer <your_jwt_token>" -H "Content-Type: text/plain" --data-binary @path/to/your/textfile.txt http://localhost:3000/api/justify
```

**Example Response (200 OK):**
```
Longtemps, je me suis couché de bonne heure. Parfois, à peine ma bougie éteinte,
mes  yeux se  fermaient si vite  que je  n’avais pas  le temps  de me  dire: «Je
m’endors.»  Et, une demi-heure après, la  pensée qu’il  était temps  de chercher
le  sommeil m’éveillait; je  voulais poser le  volume que je  croyais avoir dans
les mains  et souffler  ma lumière;  je n’avais  pas cessé  en dormant  de faire
des  réflexions  sur ce  que  je venais  de  lire, mais  ces  réflexions avaient
pris  un tour un  peu particulier; il me  semblait que j’étais  moi-même ce dont
parlait l’ouvrage: une  église, un quatuor,  la rivalité de  François Ier et  de
Charles-Quint.
```

### Rate Limiting

The API enforces a rate limit of 80,000 words per user per day for the `/api/justify` endpoint. If this limit is exceeded, the API will respond with a `402 Payment Required` status code. The word count is reset daily.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed on your machine.

### Running the Project Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/marcjazz/text-justify.git
    cd text-justify
    ```

2.  **Build and run the Docker container:**
    ```bash
    docker build -t text-justify-api .
    docker run -p 3000:3000 -d text-justify-api
    ```

The API will be available at `http://localhost:3000`.

### Running Tests

To run the test suite, you can execute the following command:

```bash
docker build -t text-justify-api .
docker run text-justify-api npm test
```
