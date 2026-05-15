import jwt from "jsonwebtoken";

const genToken = async (userid) => {
      try {
            const token = jwt.sign({userId: userid},process.env.JWT_SECRET,{expiresIn:"7d"});
            return token;
      } catch (err) {
            console.log(err);
      }
}

export default genToken;