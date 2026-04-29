# Runtime Notes

- 현재 store 는 in-memory mock 이며 Redis pub/sub 또는 DB repository 계층으로 교체할 수 있습니다.
- `/ws` heartbeat 는 운영 화면의 연결 상태 배지와 KPI 갱신 검증용입니다.
- PLC / OPC UA adapter 는 `src/lib` 하위 provider 로 분리하는 방향을 권장합니다.
- 위험 액션 로그는 Event stream 외에 별도 audit persistence 로 확장하는 것이 좋습니다.
