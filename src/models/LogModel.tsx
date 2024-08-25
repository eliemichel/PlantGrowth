
export enum LogLevel {
	Debug,
	Info,
	Warning,
	Error,
}

export type LogEntry = {
	time: Date,
	level: LogLevel,
	message: string,
}
