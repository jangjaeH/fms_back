# Runtime Notes

- 현재 store 는 mock seed 위에 JSON state file persistence 를 얹은 구조입니다. `FMS_STATE_FILE`을 지정하면 로봇, Task, Mission, Alarm, Event, 자동 Task 상태가 재시작 후 복구됩니다.
- JSON persistence 는 현장 PoC용 저장 계층이며, PostgreSQL로 전환할 때는 `src/lib/persistence.ts`의 load/save 계약을 repository adapter 로 바꾸면 됩니다.
- Mission 상태는 `MOVE_TO_SOURCE -> SOURCE_HANDSHAKE -> MOVE_TO_TARGET/DROP/CHARGER -> *_HANDSHAKE -> COMPLETED` 흐름으로 전이됩니다.
- `/ws` heartbeat 는 운영 화면의 연결 상태 배지와 KPI 갱신 검증용입니다.
- PLC / OPC UA adapter 는 `src/lib` 하위 provider 로 분리하는 방향을 권장합니다.
- 위험 액션 로그는 Event stream 외에 별도 audit persistence 로 확장하는 것이 좋습니다.
