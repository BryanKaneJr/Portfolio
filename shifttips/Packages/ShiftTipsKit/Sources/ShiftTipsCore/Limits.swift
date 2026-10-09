/// Validated bounds for every number a person can type. They keep inputs sane
/// (a typo like 75000 hours is caught) and keep the engine far from Int64
/// limits, although the engine itself never relies on them to avoid overflow.
public enum Limits {
    /// $999,999.99, the largest pool (or cash/card part) ShiftTips accepts.
    public static let maxPoolCents: Int64 = 99_999_999
    /// 1,000 hours for one person in one pool, enough for a monthly pool.
    public static let maxMinutes: Int64 = 60_000
    /// Points are fixed-point: 1000 units == 1.000 point.
    public static let pointsScale: Int64 = 1000
    /// 0.001 points, the smallest positive value.
    public static let minPointsUnits: Int64 = 1
    /// 100 points.
    public static let maxPointsUnits: Int64 = 100_000
    /// Every new person starts at 1.0 point until the policy says otherwise.
    public static let defaultPointsUnits: Int64 = 1000
    /// People in one shift.
    public static let maxParticipants = 200
    /// Characters in a person's, role's, crew's or shift's name.
    public static let maxNameLength = 60
}
