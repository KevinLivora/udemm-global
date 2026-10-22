package ar.udemm;

import com.intuit.karate.junit5.Karate;

class PruebasApiTest {
    @Karate.Test
    Karate todas() {
        return Karate.run().relativeTo(getClass());
    }
}