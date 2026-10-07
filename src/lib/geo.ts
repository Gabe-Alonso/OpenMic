export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 3958.8;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function radiusToZoom(miles: number): number {
	if (miles <= 10) return 11;
	if (miles <= 25) return 10;
	if (miles <= 50) return 9;
	if (miles <= 100) return 8;
	return 7;
}
