extends RefCounted

class_name MathUtils

static func clampf(value: float, min_value: float, max_value: float) -> float:
	return min(max(value, min_value), max_value)

