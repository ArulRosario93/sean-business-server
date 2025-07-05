
import express from 'express';
import { Router } from 'express';
import serverless from 'serverless-http';
import cors from 'cors';

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged  } from "firebase/auth";
import { count, getDoc, getDocs, getFirestore, query, where, addDoc, orderBy, limit } from "firebase/firestore";
import { collection, doc, setDoc } from "firebase/firestore";
import 'dotenv/config';

// Importing necessary Firebase modules
// This is important for initializing Firebase and accessing Firestore and Authentication services  
const firebaseConfig = {
    apiKey: process.env.APIKEY,
    authDomain: process.env.AUTHDOMAIN,
    projectId: process.env.PROJECTID,
    storageBucket: process.env.STORAGEBUCKET,
    messagingSenderId: process.env.MESSAGINGSENDERID,
    appId: process.env.APPID,
    measurementId: process.env.MEASUREMENTID
};

// Initialize Firebase
const DB = initializeApp(firebaseConfig);
const dbApp = getFirestore(DB);
const auth = getAuth()

// Initialize the Server (App)
const app = express();

// Initialize the Router
const router = Router();

// Initialize an empty object to store IP addresses
// This is important for tracking IP addresses of incoming requests
// It can be used for analytics or security purposes
const ipList = {};

// Middleware to enable CORS (Cross-Origin Resource Sharing)
// This is important for allowing requests from different origins (like your frontend app)
app.use(cors());

// Middleware to parse JSON data (form submissions)
// This is important for handling JSON data in form submissions
app.use(express.json({ limit: '50mb' }));

// Middleware to parse URL-encoded data (form submissions)
// This is important for handling form submissions

app.use(express.urlencoded({ extended: true }));

// Middleware to serve static files
// This is important for serving static files like images, CSS, and JavaScript files
app.use(express.static('public'));
// Middleware to handle serverless functions
// This is important for making the app compatible with serverless environments like Netlify

const getProducts = async () => {

    // Create a reference to the 'products' collection in Firestore
    const productsRef = query(collection(dbApp, 'products'), orderBy("timestamp", "desc"), limit("20"));

    // Fetch all documents from the 'products' collection
    const snapshot = (await getDocs(productsRef));

    // Map through the documents and extract their data
    const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    // Return the array of products
    return products;

}

const getProductByName = async (name, count) => {

    const productsRef = collection(dbApp, 'products');
    // Create a reference to the document you want to retrieve by field "name"

    // const productRef = doc(productsRef, "Golden Oversized");
    // only one product

    const productRef = query(productsRef, where("name", "==", name));

    const res = (await getDocs(productRef, )).docs[0].data();

    console.log("GOT PRODUCT BY NAME: ", res);
    return res;

};

const editProduct = async (productId, productData) => {

    // Create a reference to the 'products' collection in Firestore
    const productsRef = collection(dbApp, 'products');
    // Create a reference to the document you want to update by field "productId"
    const productRef = doc(productsRef, productId);

    // Update the document with the new data
    await setDoc(productRef, productData, { merge: true });

    console.log("Product updated successfully:", productData);

}

const getOrders = async () => {
    // Create a reference to the 'orders' collection in Firestore
    const ordersRef = query(collection(dbApp, 'orders'), orderBy("timestamp", "desc"), limit(10));

    // Fetch latest 20 documents from the 'orders' collection. by timestamp
    const snapshot = await getDocs(ordersRef);
    // Map through the documents and extract their data
    const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    // Return the array of orders
    return orders;
}

const getOrderById = async (orderId) => {
    // Create a reference to the 'orders' collection in Firestore
    const ordersRef = collection(dbApp, 'orders');
    // Create a reference to the document you want to retrieve by field "orderId"
    const orderRef = doc(ordersRef, orderId);
    // Fetch the document from Firestore
    const docSnapshot = await getDoc(orderRef);
    // Check if the document exists
    if (docSnapshot.exists()) {
        // Return the data of the document
        return {
            id: docSnapshot.id,
            ...docSnapshot.data(),
        };
    } else {
        // If the document does not exist, return null or throw an error
        console.error("No such order document!");
        return null;
    }
}

const createProduct = async (productData) => {

    // Create a reference to the 'products' collection in Firestore
    const productsRef = collection(dbApp, 'products');

    // Add a new document to the 'products' collection with the provided product data
    const docRef = await addDoc(productsRef, {
        ...productData,
        timestamp: new Date(),
    });

    console.log("Product created successfully:", docRef.id);

    // Return the ID of the newly created product
    return true;
}

router.post('/products/name', async (req, res) => {
    const { name } = req.body;

    try {

        // Create a reference to the document you want to retrieve by field "name"

        const data = await getProductByName(name, 5);
        console.log("getting ", data);
        res.json(data);

    } catch (error) {

        console.error("Error fetching products: ", error);
        res.status(500).json({ error: 'Failed to fetch products' });

    }
});

router.get('/products', async (req, res) => {

    try {

        // Create a reference to the document you want to retrieve by field "name"

        const data = await getProducts();
        res.json(data);

    } catch (error) {

        console.error("Error fetching products: ", error);
        res.status(500).json({ error: 'Failed to fetch products' });

    }

});

// USER LOGIN
router.post("/userlogin", async (req, res) => {

    const { email, password } = req.body;

    // LOGIN ACCOUNT THROUGH FIREBASE

    await signInWithEmailAndPassword(auth, email, password)
    .then((userCredentials) => {
        const userID = userCredentials.user.uid;

        const usersRef = collection(dbApp, 'users');
        // Create a new document in the 'users' collection with the user's UID as the document ID
        const userDocRef = doc(usersRef, userID);

        // Get the user data from the Firestore document
        getDoc(userDocRef)
        .then((doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                console.log("User logged in successfully:", userData);
                res.json(userData);
            } else {
                res.json({ error: "No such user document!" });
            }
        })
    })
    .catch((error) => {
        res.json(error.message);
    });

});


// USER REGISTER
router.post("/userregister", async (req, res) => {

    const { email, password, name } = req.body;

    // REGISTER USER THROUGH FIREBASE

    await createUserWithEmailAndPassword(auth, email, password)
    .then((userCredentials) => {
        const userID = userCredentials.user.uid;

        const user = { 
            name: name,
            uid: userID,
            emailAddress: email,
            phoneNumber: "",
            addedToCart: [],
            orders: []
        };

        // Create a reference to the 'users' collection in Firestore
        const usersRef = collection(dbApp, 'users');
        // Create a new document in the 'users' collection with the user's UID as the document ID
        const userDocRef = doc(usersRef, userID);
        // Set the user data in the Firestore document
        setDoc(userDocRef, user)
        .then(() => {
            console.log("User registered successfully:", user);
        })

        res.json(user);
    })
    .catch((error) => {
        res.json(error.message);
    })

});

// ADMIN METHODS
router.post("/admin", async (req, res) => {

    const { password } = req.body;
    console.log("Received admin password: ", password);
    console.log("Admin password: ", password);
    try {

        // Create a reference to the document you want to retrieve by field "name"
        if (password == process.env.ADMINPASSWORD) {

            res.json(process.env.ADMINPASSWORD);

        }else{
            
            res.json(process.env.ADMINPASSWORD);
        
        }

    } catch (error) {
        res.status(500).json({ error: error.message });

    }
});

router.get("/admin/product", async (req, res) => {

    try {
        const data = await getProducts();
        res.json(data);
        
    } catch (error) {

        console.error("Error fetching products: ", error);
        
        res.status(500).json({ error: error.message });

    }
});


router.post("/admin/product/name", async (req, res) => {

    // get only one product by name
    const { name } = req.body;

    console.log("name: ", name);
    try {
        // Create a reference to the document you want to retrieve by field "name"

        const data = await getProductByName(name, 1);
        console.log("getting ", data);
        res.json(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });

    }
});


router.post("/admin/product/edit", async (req, res) => {
    const { productId, productdata } = req.body;

    console.log("productId: ", productId);
    console.log("productdata: ", productdata);

    try {
        // Create a reference to the document you want to update by field "productId"
        await editProduct(productId, productdata);
        res.json({ message: "Product updated successfully" });
        
    } catch (error) {
        console.error("Error updating product: ", error);
        res.status(500).json({ error: error.message });
    }

});


// ADMIN ORDERS
router.get("/admin/orders", async (req, res) => {
    
    try {

        const data = await getOrders();
        res.json(data);
        
    } catch (error) {

        res.status(500).json({ error: error.message });
        
    }
});

// ADMIN ORDERS BY ID
router.post("/admin/orders/id", async (req, res) => {

    const { id } = req.body;

    try {

        const data = await getOrderById(id);
        res.json(data);
        
    } catch (error) {

        res.status(500).json({ error: error.message });
        
    }
});

router.post("/admin/createproduct", async (req, res) => {
    const { productData } = req.body;

    try {
        const newProduct = await createProduct(productData);
        console.log("New product created:", newProduct);
        res.json(newProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

});

router.get('/', (req, res) => {

    console.log(req.socket.remoteAddress);

    res.send(`Hello World! ${req.socket.localAddress}`,);

});

// app.listen(5000, () => {
//     console.log("Server is running on port 5000");
// });


app.use("/.netlify/functions/app", router); // This line is important for serverless functions to work correctly

module.exports.handler = serverless(app); // Export the app as a serverless function

// export const handler = serverless(app); // Export the app as a serverless function