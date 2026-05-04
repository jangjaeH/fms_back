# Robot Monitoring Backend

`FMS_V1_Screen_Design_Spec`의 P0/P1 화면 요구사항을 빠르게 검증할 수 있도록 만든 Node.js 기반 mock backend입니다.

## 포함 범위

- Dashboard, Map, Task, Mission, Equipment, Alarm, Event용 REST API
- `/ws` 실시간 heartbeat/snapshot WebSocket
- 위험 액션 이력화를 염두에 둔 override/alarm/task mutation 엔드포인트
- Vitest + Supertest 기반 기본 API 테스트

## 실행

```bash
npm install
npm run dev
```

기본 포트는 `4000`입니다.

## Docker

```bash
docker compose -f ../docker-compose.yml up --build
```

- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- `POST /tasks` 또는 `POST /missions`로 Task를 생성하면 가용 로봇에 즉시 Mission이 배정됩니다.
- `GET/PATCH /simulation/auto-tasks`로 idle 로봇에 Task를 자동 생성하는 시뮬레이터를 확인하거나 켜고 끌 수 있습니다.
