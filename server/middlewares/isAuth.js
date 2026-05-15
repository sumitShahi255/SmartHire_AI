
import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.userId = decoded.userId || decoded.userid;
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

export default isAuth;