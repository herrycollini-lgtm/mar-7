FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MARE_HOST=0.0.0.0 \
    MARE_PORT=8000 \
    MARE_DB_PATH=/var/lib/mare/mare.sqlite3 \
    MARE_COOKIE_SECURE=1 \
    MARE_CLIENT_IP_HEADER="CF-Connecting-IP,True-Client-IP,X-Forwarded-For"

RUN addgroup --system mare \
    && adduser --system --ingroup mare --home /app mare \
    && mkdir -p /var/lib/mare \
    && chown -R mare:mare /app /var/lib/mare

COPY --chown=mare:mare . .

USER mare

VOLUME ["/var/lib/mare"]
EXPOSE 8000

CMD ["python", "server.py"]
