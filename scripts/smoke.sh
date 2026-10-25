#!/bin/bash
# Roomly end-to-end smoke test (run with the server on :5000)
BASE=http://localhost:5000/api/v1
GUEST_TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"guest@roomly.demo","password":"RoomlyDemo123"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
ROOM=$(curl -s "$BASE/rooms?limit=1" | python -c "import sys,json;print(json.load(sys.stdin)['data']['rooms'][0]['bookableRoomIds'][0])")
CI=$(date -d "+40 days" +%F); CO=$(date -d "+42 days" +%F)
BK=$(curl -s -X POST $BASE/bookings -H "Authorization: Bearer $GUEST_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":\"$ROOM\",\"checkIn\":\"${CI}T14:00:00Z\",\"checkOut\":\"${CO}T12:00:00Z\",\"guestCount\":2}")
echo "$BK" | head -c 300; echo
BKID=$(echo "$BK" | python -c "import sys,json;print(json.load(sys.stdin)['data']['booking']['_id'])")
curl -s -X POST "$BASE/bookings/$BKID/payments/demo" -H "Authorization: Bearer $GUEST_TOKEN" | head -c 200; echo
curl -s -X POST "$BASE/bookings/$BKID/payments/demo/confirm" -H "Authorization: Bearer $GUEST_TOKEN" -H 'Content-Type: application/json' -d '{"result":"succeed"}' | head -c 300; echo
curl -s "$BASE/bookings/$BKID/invoice" -H "Authorization: Bearer $GUEST_TOKEN" | python -c "import sys,json;i=json.load(sys.stdin)['data']['invoice'];print('invoice:',i['invoiceNumber'],i['paymentOutcome'])"
MGR_TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"manager@roomly.demo","password":"RoomlyDemo123"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -s "$BASE/reports/overview" -H "Authorization: Bearer $MGR_TOKEN" | head -c 80; echo " (403 expected for manager)"
GUEST_BOARD=$(curl -s "$BASE/operations/board?hotelId=0" -H "Authorization: Bearer $GUEST_TOKEN" | head -c 80)
echo "guest board attempt: $GUEST_BOARD"
