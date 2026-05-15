import User from "../models/user.model.js"

export const getCurrentUser = async (req,res) => {
      try {
          const userId = req.userId
          const user = await User.findById(userId)
          if(!user){
            return res.status(404).json({message:"user doen not found"})
          } 
          return res.status(200).json(user) 
      } catch (error) {
          return res.status(500).json({message:`failed to get currentUser ${error}`})  
      }
}

// Temporary route for you to top-up credits during development
export const topUpCredits = async (req, res) => {
      try {
            await User.updateMany({}, { credits: 5000 });
            return res.status(200).send("<h1>All users topped up to 5000 credits!</h1><p>You can go back to the app now.</p>");
      } catch (error) {
            return res.status(500).json({message:`failed to top up ${error}`});
      }
}