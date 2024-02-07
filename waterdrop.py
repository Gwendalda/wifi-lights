import itertools
from Lightbulb import LightBulb
import time
import json
import threading

def create_light_matrix(lights:list, rows=4, cols=4):
    matrix = [[None for _ in range(cols)] for _ in range(rows)]
    for light in lights:
        _, position = light.name.split(" ")
        row, col = map(int, position.split("-"))
        matrix[row-1][col-1] = light
    return matrix

def gradual_brightness_change(light:LightBulb, start_percentage, end_percentage, steps=5, duration=0.2):
    step_size = (end_percentage - start_percentage) / steps
    for i in range(steps + 1):
        current_percentage = start_percentage + step_size * i
        print(current_percentage)
        # print(light.get_status())
        light.set_brightness_percentage(round(current_percentage), nowait=True)
        time.sleep(duration / steps)

def water_drop_pulse(light, duration, on_max_brightness=None):
    half_duration = duration / 2
    gradual_brightness_change(light, 5, 100, steps=50, duration=half_duration)
    on_max_brightness() 
    gradual_brightness_change(light, 100, 5, steps=50, duration=half_duration)

def get_neighbors(matrix, row, col):
    """
    Returns a list of neighboring lights given a position in the matrix.
    """
    neighbors = []
    for dr in [-1, 0, 1]:  # Delta row
        for dc in [-1, 0, 1]:  # Delta column
            if dr == 0 and dc == 0:
                continue  # Skip the original light itself
            new_row, new_col = row + dr, col + dc
            if 0 <= new_row < len(matrix) and 0 <= new_col < len(matrix[0]) and matrix[new_row][new_col]:
                neighbors.append(matrix[new_row][new_col])
    return neighbors


def water_drop_effect_threaded(matrix, start_row, start_col, pulse_duration=2, neighbor_delay=0.5):
    visited = set()
    threads = []
    queue = [(start_row, start_col, 0)]  # (row, col, depth)
    completion_events = {}  # Dictionary for completion events, keyed by light position

    def pulse_light_with_delay(light, duration, on_complete_callback):
        """Pulse the light and call the callback when reaching 100% brightness."""
        water_drop_pulse(light, duration, on_complete_callback)

    while queue:
        current_row, current_col, depth = queue.pop(0)
        current_position = (current_row, current_col)
        if current_position in visited:
            continue
        visited.add(current_position)
        current_light = matrix[current_row][current_col]
        if current_light:
            # Each light gets an event to signal when it has reached 100% brightness
            completion_event = threading.Event()
            completion_events[current_position] = completion_event

            def on_max_brightness():
                time.sleep(neighbor_delay)  # Delay to slow down the spread
                completion_event.set()  # Signal that this light reached 100% brightness

            # Thread to pulse the light and signal completion
            thread = threading.Thread(target=pulse_light_with_delay, args=(current_light, pulse_duration, on_max_brightness))
            threads.append((depth, thread))


        # Enqueue neighbors using LightBulb object's row and column attributes
        neighbors = get_neighbors(matrix, current_row, current_col)
        for neighbor in neighbors:
            neighbor_row, neighbor_col = neighbor.row, neighbor.column  # Access attributes directly
            if (neighbor_row, neighbor_col) not in visited:
                queue.append((neighbor_row, neighbor_col, depth + 1))

    # Start threads with synchronization
    for depth, thread in sorted(threads, key=lambda x: x[0]):
        if depth > 0:
            # Wait for all lights at the previous depth level to reach 100% brightness
            for (prev_row, prev_col), event in completion_events.items():
                if (prev_row, prev_col) in [(r, c) for r, c, d in queue if d == depth - 1]:
                    event.wait()  # Ensure previous depth lights have signaled reaching 100% brightness
        thread.start()

    #for _, thread in threads:
    #    thread.join()

def find_light_position(light, matrix):
    """
    Finds the position (row, col) of a light in the matrix.
    """
    for i, row in enumerate(matrix):
        if light in row:
            return (i, row.index(light))
    return (-1, -1)  # Indicates the light was not found in the matrix


def water_drop_effect(matrix, start_row, start_col, total_duration=2):
    """
    Triggers the water drop effect from a starting light and spreads to neighbors.
    """
    visited = set()
    queue = [(start_row, start_col, 0)]  # (row, col, depth)
    max_depth = max(len(matrix), len(matrix[0]))  # Max possible depth to ensure all lights get covered

    while queue:
        current_row, current_col, depth = queue.pop(0)
        if depth > max_depth:
            break  # Prevent infinite loop
        if (current_row, current_col) in visited:
            continue
        visited.add((current_row, current_col))
        current_light = matrix[current_row][current_col]
        if current_light:
            # Delay based on depth to simulate ripple effect
            time.sleep(depth * total_duration / max_depth)
            water_drop_pulse(current_light, duration=total_duration / max_depth)

        # Enqueue neighbors with increased depth
        neighbors = get_neighbors(matrix, current_row, current_col)
        for neighbor in neighbors:
            n_row, n_col = find_light_position(neighbor, matrix)
            if (n_row, n_col) not in visited:
                queue.append((n_row, n_col, depth + 1))

if __name__ == "__main__":
    lights = LightBulb.load_devices("devices.json")
    matrix = create_light_matrix(lights)
    water_drop_effect_threaded(matrix, 0, 0, 10, 2)  # Assuming Light 2-2 is in the middle

