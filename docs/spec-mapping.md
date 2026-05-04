# Backend Spec Mapping

## Core APIs

- `GET /dashboard/summary`
- `GET /map`
- `GET /robots`
- `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- `GET /missions`, `GET /missions/active`, `PATCH /missions/:id`, `POST /missions/:id/override`
- `GET /equipment`, `POST /equipment/:id/reset`
- `GET /alarms`, `PATCH /alarms/:id/ack`, `PATCH /alarms/:id/resolve`
- `GET /events?type=&source=&q=`, `GET /events/export?type=&source=&q=`

## Realtime

- `WS /ws`
- snapshot payload: summary, robots, alarms
- heartbeat payload: timestamp, summary

## Design Intent

- 위험 액션에 대한 이력화를 mutation 이벤트로 남김
- 설비 reset, alarm ack/resolve, mission override, task mutation은 Event Log에 append
- 초기 화면은 REST snapshot 만으로도 구성 가능
- Redis, DB, PLC adapter 는 다음 단계에서 provider 계층으로 교체 가능
