import React from "react";
import { HiSparkles, HiOutlineLightningBolt } from "react-icons/hi";
import { FcGoogle } from "react-icons/fc";
import { motion } from "motion/react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../utils/firebase";
import axios from "axios";
import { ServerUrl } from "../App";
import { useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";

function Auth({isModel = false}) {
      const dispatch = useDispatch()
      const handleGoogleAuth = async () => {
            try {
                  const response = await signInWithPopup(auth,provider);
                  let User = response.user;
                  let name = User.displayName;
                  let email = User.email;
                  const result = await axios.post(ServerUrl + "/api/auth/google",
                  {name,email},{withCredentials:true});
                  dispatch(setUserData(result.data))
            } catch (err) {
                  console.log(err);
                  dispatch(setUserData(null))
            }
      }
  return (
    <div className={`
      w-full
      ${isModel ? "py-4" :"min-h-screen bg-[#f3f3f3] flex items-center justify-center px-6 py-20"}
      `}>

      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className={` 
          w-full 
          ${isModel ? "max-w-md p-8 rounded-3xl" : "max-w-lg p-12 rounded-4xl"} bg-white shadow-2xl border border-gray-200
          `}>

        <div className="flex items-center justify-center gap-3 mb-6">

          <motion.div
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="bg-linear-to-r from-purple-500 to-indigo-600 text-white p-3 rounded-xl shadow-md">
            <HiSparkles size={20} />
          </motion.div>

          <h2 className="text-xl font-semibold text-gray-800">SmartHire.AI</h2>

        </div>

        <h3 className="text-3xl font-semibold text-center mb-3">
          Start Your AI Interview Practice
        </h3>

        <div className="flex justify-center mb-4">
          <span className="bg-green-100 text-green-600 px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1.5">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}>

            <HiSparkles size={14} />
            </motion.span>
            <HiOutlineLightningBolt size={14} />
            AI Smart Interview
          </span>
        </div>

        <p className="text-gray-500 text-center text-sm leading-relaxed mb-8">
          Sign in to practice AI-powered interviews, receive real-time feedback,
          and track your progress with confidence.
        </p>

        <motion.button
          onClick={handleGoogleAuth}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full flex items-center justify-center gap-3 py-3 bg-black hover:bg-gray-900 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200">

          <FcGoogle size={20} />
          <span className="text-sm font-medium">Continue with Google</span>

        </motion.button>

      </motion.div>

    </div>
  );
}

export default Auth;
