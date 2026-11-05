FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn --batch-mode --no-transfer-progress verify

FROM eclipse-temurin:25-jre-jammy
RUN groupadd --gid 10001 clarigence && useradd --uid 10001 --gid clarigence --no-create-home clarigence
WORKDIR /app
COPY --from=build --chown=clarigence:clarigence /build/target/contact-api-1.0.0.jar /app/contact-api.jar
USER clarigence
ENV SESSION_COOKIE_SECURE=true
ENV SPRING_PROFILES_ACTIVE=production
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/contact-api.jar"]
