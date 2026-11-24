import os
import re
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "primal-rush-dev-key")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading", ping_interval=25, ping_timeout=60)

# room -> sid -> player data
rooms = {}

@app.get("/")
def health():
    return jsonify({"game": "Primal Rush multiplayer server", "status": "online"})

def clean_room(value):
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())[:12]

@socketio.on("join_room")
def on_join(data):
    room = clean_room(data.get("room"))
    if not room:
        emit("room_error", {"message": "Invalid room code"})
        return
    # A player may only be in one room at a time.
    for old_room in list(rooms):
        if request_sid_in_room(old_room):
            leave_room(old_room)
            rooms[old_room].pop(request_sid(), None)
            if not rooms[old_room]:
                rooms.pop(old_room, None)
    join_room(room)
    player = {
        "name": str(data.get("name", "Player"))[:16],
        "color": str(data.get("color", "#9cff45"))[:16],
        "x": float(data.get("x", 0) or 0),
        "y": 0.0,
        "z": float(data.get("z", 0) or 0),
        "yaw": float(data.get("yaw", 0) or 0),
    }
    rooms.setdefault(room, {})[request_sid()] = player
    emit("room_state", {"players": {sid: p for sid, p in rooms[room].items() if sid != request_sid()}, "count": len(rooms[room])})
    emit("player_joined", {"id": request_sid(), **player, "count": len(rooms[room])}, to=room, include_self=False)

@socketio.on("player_update")
def on_update(data):
    room = clean_room(data.get("room"))
    sid = request_sid()
    if room not in rooms or sid not in rooms[room]:
        return
    old = rooms[room][sid]
    for key in ("x", "y", "z", "yaw", "lx", "ly", "lz", "rx", "ry", "rz"):
        if key in data:
            try:
                old[key] = max(-1000.0, min(1000.0, float(data[key])))
            except (TypeError, ValueError):
                pass
    for key in ("name", "color"):
        if key in data:
            old[key] = str(data[key])[:16]
    emit("player_update", {"id": sid, **old}, to=room, include_self=False)

@socketio.on("leave_room")
def on_leave(data):
    room = clean_room(data.get("room"))
    sid = request_sid()
    if room in rooms and sid in rooms[room]:
        leave_room(room)
        rooms[room].pop(sid, None)
        count = len(rooms[room])
        emit("player_left", {"id": sid, "count": count}, to=room)
        if not rooms[room]:
            rooms.pop(room, None)

def request_sid():
    return request.sid

def request_sid_in_room(room):
    # Socket.IO rooms are also tracked in our dictionary.
    return request_sid() in rooms.get(room, {})

@socketio.on("disconnect")
def on_disconnect():
    sid = request_sid()
    for room in list(rooms):
        if sid in rooms[room]:
            rooms[room].pop(sid, None)
            emit("player_left", {"id": sid, "count": len(rooms[room])}, to=room)
            if not rooms[room]:
                rooms.pop(room, None)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), allow_unsafe_werkzeug=True)
